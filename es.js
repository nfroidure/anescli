'use strict';

const request = require('request');

module.exports = {
  switchAlias,
  createIndex,
  deleteIndex,
  analyzeIndex,
  statsFieldData,
  pipeIndex,
  pumpToIndex,
  mappings,
  createTemplate,
  deleteTemplate,
  nodeStats: _simpleGet.bind(null, '_nodes/stats'),
  clusterStats: _simpleGet.bind(null, '_cluster/stats'),
  pendingTasks: _simpleGet.bind(null, '_cluster/pending_tasks'),
  settings: _simpleGet.bind(null, '_cluster/settings'),
  state: _simpleGet.bind(null, '_cluster/state'),
  health: _simpleGet.bind(null, '_cluster/health?level=indices'),
};

function switchAlias({ logger, config }, { type, from, to, suffix }) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        '_aliases',
      ].join('/'),
      method: 'POST',
      json: true,
      body: {
        actions: (
          from ?
          [{ remove: {
            index: buildIndexName(config, type, from, suffix),
            alias: buildAliasName(config, type),
          } }] :
          []
        ).concat([{ add: {
          index: buildIndexName(config, type, to, suffix),
          alias: buildAliasName(config, type),
        } }]),
      },
    }
  ));
}

function createIndex({ logger, config }, { type, version, mappings, suffix }) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        buildIndexName(config, type, version, suffix),
      ].join('/'),
      method: 'PUT',
      json: true,
      body: {
        mappings: {
          [type]: mappings,
        },
      },
    }
  ));
}

function deleteIndex({ logger, config }, { type, version, suffix }) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        buildIndexName(config, type, version, suffix),
      ].join('/'),
      method: 'DELETE',
      json: true,
    }
  ));
}

function analyzeIndex({ logger, config }, { type, version, suffix, field, text }) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        buildIndexName(config, type, version, suffix),
        '_analyze',
      ].join('/'),
      method: 'GET',
      json: true,
      body: {
        field,
        text,
      },
    }
  ));
}

function createTemplate({
  logger, config,
}, {
  type, version, mappings,
  suffixPattern = '*-*', template,
}) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        '_template',
        buildIndexName(config, type, version),
      ].join('/'),
      method: 'PUT',
      json: true,
      body: {
        index_patterns: buildIndexName(config, type, version, suffixPattern),
        mappings: {
          [type]: template,
        },
      },
    }
  ));
}

function deleteTemplate({
  logger, config,
}, {
  type, version, suffixPattern = '*-*',
}) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        '_template',
        buildIndexName(config, type, version),
      ].join('/'),
      method: 'DELETE',
      json: true,
    }
  ));
}

function mappings({ logger, config }, { type, version, suffix }) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        buildIndexName(config, type, version, suffix),
        '_mappings',
      ].join('/'),
      method: 'GET',
      json: true,
    }
  ));
}

function pipeIndex({ logger, config }, { type, from, to, suffix, transformFunction }) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        buildIndexName(config, type, from, suffix),
        '_search?scroll=1m',
      ].join('/'),
      method: 'POST',
      json: true,
      body: {
        size: 1000,
      },
    }
  ))
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

function putToTheNewIndex( // eslint-disable-line
  { logger, config },
  { type, from, to, suffix, transformFunction },
  page,
  scrollId,
  items
) {
  logger.log(`Got ${items.length} items in page ${page}.`);
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        '_bulk',
      ].join('/'),
      headers: {},
      // Here we do not use JSON but the ElasticSearch special batch
      // command thing
      method: 'POST',
      body: items.reduce((ops, item) =>
        ops.concat([
          { create: {
            _index: buildIndexName(config, type, to, suffix),
            _type: type,
            _id: item._id,
          } },
          transformFunction(item._source),
        ]),
        []
      )
      .map(op => JSON.stringify(op))
      .join('\n'),
    }
  ))
  .catch((err) => {
    logger.debug(page);
    throw err;
  })
  .then((body) => {
    logger.info(`${items.length} items sent.`, page);
    logger.debug(body);
    return getNextBatch(
      { logger, config },
      { type, from, to, suffix, transformFunction },
      page + 1,
      scrollId
    );
  });
}

function getNextBatch(
  { logger, config },
  { type, from, to, suffix, transformFunction },
  page,
  scrollId
) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        '_search',
        'scroll',
      ].join('/'),
      method: 'POST',
      json: true,
      body: {
        scroll: '3m',
        scroll_id: scrollId,
      },
    }
  ))
  .then((body) => {
    if(body.hits.hits.length) {
      return putToTheNewIndex(
        { logger, config },
        { type, from, to, suffix, transformFunction },
        page,
        scrollId,
        body.hits.hits
      );
    }
    return Promise.resolve();
  });
}

function pumpToIndex({ logger, config }, { type, version, suffix, pumpFunction }) {
  return pumpFunction({ logger, putToIndex });

  function putToIndex(items) {
    return doRequest({ logger }, Object.assign(
      {},
      config.options || {},
      {
        url: [
          config.elastic,
          '_bulk',
        ].join('/'),
        method: 'POST',
        body: items.reduce((ops, item) =>
          ops.concat([
            { create: {
              _index: buildIndexName(config, type, version, suffix),
              _type: type,
              _id: item._id,
            } },
            item._source,
          ]),
          []
        )
        .map(op => JSON.stringify(op))
        .join('\n') + '\n',
      }
    ))
    .then((body) => {
      logger.debug(body);
      return body;
    });
  }
}

function statsFieldData({ logger, config }, { fields = '*' }) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        '_stats',
        'fielddata',
      ].join('/'),
      method: 'GET',
      json: true,
      query: {
        fields,
      },
    }
  ));
}

function _simpleGet(path, { logger, config }, unused) {
  return doRequest({ logger }, Object.assign(
    {},
    config.options || {},
    {
      url: [
        config.elastic,
        path,
      ].join('/'),
      method: 'GET',
      json: true,
    }
  ));
}

function buildIndexName(config, type, version, suffix) {
  return [config.project, type, version, suffix].filter(identity).join('-');
}

function buildAliasName(config, type) {
  return [config.project, type].filter(identity).join('-');
}

function identity(a) { return a; }

function doRequest({ logger }, options) {
  return new Promise(
    (resolve, reject) =>
    request(options, (err, res) => {
      if(err) {
        logger.error('Error:', err.stack);
        reject(err);
        return;
      }
      resolve(res.body);
    })
  );
}
