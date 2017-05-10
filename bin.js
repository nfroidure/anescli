#!/usr/bin/env node

const prog = require('caporal');
const path = require('path');
const fs = require('fs');
const es = require('./es');
const config = require(path.join(process.cwd(), 'config'));
const JSON_EXT = '.json';
const JS_EXT = '.js';
const AVAILABLE_TYPES = (() => {
  try {
    return fs.readdirSync('./mappings')
      .filter(file => file.endsWith(JSON_EXT))
      .map(file => file.slice(0, file.length - JSON_EXT.length));
  } catch(err) {
    return [];
  }
})();
const AVAILABLE_PUMPS = (() => {
  try {
    return fs.readdirSync('./pumps')
      .filter(file => file.endsWith(JS_EXT))
      .map(file => file.slice(0, file.length - JS_EXT.length));
  } catch(err) {
    return [];
  }
})();
const INDEX_TYPE_REGEXP = new RegExp('^' + AVAILABLE_TYPES.join('|') + '$');
const PUMPABLE_INDEX_TYPE_REGEXP = new RegExp('^' + AVAILABLE_PUMPS.join('|') + '$');
const INDEX_VERSION_REGEXP = /^v\d+\.\d+\.\d+$/;

prog
  .version(require('./package.json').version)
  .command('switch', 'Switch an alias to another index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<to>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[from]', 'Old index version', INDEX_VERSION_REGEXP)
  .action(({ type, from, to }, options, logger) => {
    _runAction(logger, es.switch, { type, from, to });
  })
  .command('pipe', 'Copy an index content to another index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<to>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[from]', 'Old index version', INDEX_VERSION_REGEXP)
  .action(({ type, from, to }, options, logger) => {
    let transformFunction;
    try {
      transformFunction = require('./transformers/' + type + JS_EXT);
    } catch (err) {
      logger.debug('No tranformation found.', err.stack);
      transformFunction = identity;
    }

    _runAction(logger, es.pipe, { type, from, to, transformFunction });
  })
  .command('create', 'Create an index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .action(({ type, version }, options, logger) => {
    const mappings = JSON.parse(fs.readFileSync('./mappings/' + type + JSON_EXT));

    _runAction(logger, es.createIndex, { type, version, mappings });
  })
  .command('delete', 'Delete an index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .action(({ type, version }, options, logger) => {
    _runAction(logger, es.deleteIndex, { type, version });
  })
  .command('analyze', 'Analyze an index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('<field>', 'Field to analyze')
  .argument('<text>', 'Text for that field')
  .action(({ type, version, field, text }, options, logger) => {
    _runAction(logger, es.analyzeIndex, { type, version, field, text });
  })
  .command('pump', 'Pump a source items to an index.')
  .argument('<type>', 'Index type', PUMPABLE_INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .action(({ type, version }, options, logger) => {
    const pumpFunction = require('./pumps/' + type + JS_EXT);
    _runAction(logger, es.pumpToIndex, { type, version, pumpFunction });
  });

prog.parse(process.argv);

function _runAction(logger, fn, ...args) {
  return fn({ logger, config }, ...args)
  .then((result) => {
    logger.info(result);
    process.exit();
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}

function identity(a) { return a; }
