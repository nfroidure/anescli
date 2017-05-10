const request = require('request');

module.exports = {
  switchAlias,
  createIndex,
  deleteIndex,
  analyzeIndex,
  pipeIndex,
  pumpIndex,
};

function switchAlias({ logger, config }, { type, from, to }) {
  return new Promise((resolve, reject) => {
    request({
      url: [
        config.elastic,
        '_aliases'
      ].join('/'),
      method: 'POST',
      json: true,
      body: {
        actions: (
          from
          ? [{ remove: {
            index: buildIndexName(config, type, from),
            alias: buildAliasName(config, type, from),
          } }]
          : []
        ).concat([{ add: {
          index: buildIndexName(config, type, to),
          alias: buildAliasName(config, type, to),
        } }])
      }
    }, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res.body);
    });
  });
}

function createIndex({ logger, config }, { type, version, mappings }) {
  return new Promise((resolve, reject) => {
    request({
      url: [
        config.elastic,
        buildIndexName(config, type, version)
      ].join('/'),
      method: 'PUT',
      json: true,
      body: {
        mappings: {
          [type]: mappings
        }
      },
    }, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res.body);
    });
  });
}

function deleteIndex({ logger, config }, { type, version }) {
  return new Promise((resolve, reject) => {
    request({
      url: [
        config.elastic,
        buildIndexName(config, type, version),
      ].join('/'),
      method: 'DELETE',
      json: true,
    }, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res.body);
    });
  });
}

function analyzeIndex({ logger, config }, { type, version, field, text }) {
  return new Promise((resolve, reject) => {
    request({
      url: [
        config.elastic,
        buildIndexName(config, type, version),
        '_analyze',
      ].join('/'),
      method: 'GET',
      json: true,
      body: {
        field,
        text
      }
    }, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res.body);
    });
  });
}

function pipeIndex({ logger, config }, { type, from, to, transformFunction }) {
  return new Promise((resolve, reject) => {
    request({
      url: [
        config.elastic,
        buildIndexName(config, type, from),
        '_search?scroll=1m',
      ].join('/'),
      method: 'POST',
      json: true,
      body: {
        size: 1000
      }
    }, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res.body);
    });
  })
  .then((body) => {
    const scrollId = body._scroll_id;
    let page = 1;
    logger.info('New scroll : ' + scrollId);
    return putToTheNewIndex(
      { logger, config },
      { type, from, to, transformFunction },
      page,
      scrollId,
      body.hits.hits
    );
  });
}

function putToTheNewIndex (
  { logger, config },
  { type, from, to, transformFunction },
  page,
  scrollId,
  items
) {
  logger.log(`Got ${items.length} items in page ${page}.`);
  return new Promise((resolve, reject) => {
    request({
      url: [
        config.elastic,
        '_bulk',
      ].join('/'),
      headers: {},
      // Here we do not use JSON but the ElasticSearch special batch
      // command thing
      method: 'POST',
      body: items.reduce((ops, item) => {
        return ops.concat([
          { create: {
            _index: buildIndexName(config, type, to),
            _type: type,
            _id: item._id
          } },
          transformFunction(item._source),
        ]);
      }, [])
      .map((op) => JSON.stringify(op))
      .join('\n')
    }, (err, res) => {
      if (err) {
        logger.error('Error:', err.stack);
        logger.debug(page);
        reject(err);
        return;
      }
      logger.info(`${items.length} items sent.`, page);
      logger.debug(res.body);
      resolve(getNextBatch(
        { logger, config },
        { type, from, to, transformFunction },
        page + 1,
        scrollId
      ));
    });
  });
}

function getNextBatch (
  { logger, config },
  { type, from, to, transformFunction },
  page,
  scrollId
) {
  return new Promise((resolve, reject) => {
    request({
      url: [
        config.elastic,
        '_search',
        'scroll',
      ].join('/'),
      method: 'POST',
      json: true,
      body: {
        scroll: '3m',
        scroll_id: scrollId
      }
    }, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      if (res.body.hits.hits.length) {
        resolve(putToTheNewIndex(
          { logger, config },
          { type, from, to, transformFunction },
          page,
          scrollId,
          res.body.hits.hits
        ));
        return;
      }
      resolve();
    });
  });
}

function pumpIndex({ logger, config }, { type, version }) {
  function putToIndex(items) {
    return new Promise((resolve, reject) => {
      request({
        url: [
          config.elastic,
          '_bulk'
        ].join('/'),
        method: 'POST',
        body: items.reduce((ops, item) => {
          return ops.concat([
            { create: {
              _index: buildIndexName(config, type, version),
              _type: type,
              _id: item._id
            } },
            item._source
          ]);
        }, [])
        .map((op) => JSON.stringify(op))
        .join('\n')
      }, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res.body);
      });
    });
  }
}

function buildIndexName(config, type, version) {
  return [config.project, type, version].filter(identity).join('-');
}

function buildAliasName(config, type) {
  return [config.project, type].filter(identity).join('-');
}

function identity(a) { return a; }
