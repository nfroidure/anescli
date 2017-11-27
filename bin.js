#!/usr/bin/env node
/* eslint global-require:0 */
'use strict';

const prog = require('caporal');
const path = require('path');
const fs = require('fs');
const es = require('./es');
const config = require(path.join(process.cwd(), 'config'));
const MAPPINGS_DIR = process.env.MAPPINGS_DIR ||
  path.join(process.cwd(), 'mappings');
const TEMPLATES_DIR = process.env.TEMPLATES_DIR ||
  path.join(process.cwd(), 'mappings');
const PUMPS_DIR = process.env.PUMPS_DIR ||
  path.join(process.cwd(), 'pumps');
const JSON_EXT = '.json';
const JS_EXT = '.js';
const AVAILABLE_TYPES = (() => {
  try {
    return fs.readdirSync(MAPPINGS_DIR)
      .filter(file => file.endsWith(JSON_EXT))
      .map(file => file.slice(0, file.length - JSON_EXT.length));
  } catch (err) {
    return [];
  }
})();
const AVAILABLE_PUMPS = (() => {
  try {
    return fs.readdirSync(PUMPS_DIR)
      .filter(file => file.endsWith(JS_EXT))
      .map(file => file.slice(0, file.length - JS_EXT.length));
  } catch (err) {
    return [];
  }
})();
const INDEX_TYPE_REGEXP = new RegExp('^' + AVAILABLE_TYPES.join('|') + '$');
const PUMPABLE_INDEX_TYPE_REGEXP = new RegExp('^' + AVAILABLE_PUMPS.join('|') + '$');
const INDEX_VERSION_REGEXP = /^v\d+\.\d+\.\d+$/;
const FIELDS_REGEXP = /((^|,)[a-z0-9]+)+$/;

prog
  .version(require('./package.json').version)
  .command('switch', 'Switch an alias to another index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<to>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[from]', 'Old index version', INDEX_VERSION_REGEXP)
  .argument('[suffix]', 'Index suffix if some')
  .action(({ type, from, to, suffix }, options, logger) => {
    _runAction(logger, es.switchAlias, { type, from, to, suffix });
  })
  .command('pipe', 'Copy an index content to another index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<to>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[from]', 'Old index version', INDEX_VERSION_REGEXP)
  .argument('[suffix]', 'Index suffix if some')
  .action(({ type, from, to, suffix }, options, logger) => {
    let transformFunction;
    try {
      transformFunction = require(path.join(
        process.cwd(),
        'transformers',
        type + JS_EXT
      ));
    } catch (err) {
      logger.debug('No tranformation found.', err.stack);
      transformFunction = identity;
    }

    _runAction(logger, es.pipeIndex, { type, from, to, suffix, transformFunction });
  })
  .command('create', 'Create an index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[suffix]', 'Index suffix if some')
  .action(({ type, version, suffix }, options, logger) => {
    const mappings = JSON.parse(fs.readFileSync(path.join(
      MAPPINGS_DIR,
      type + JSON_EXT
    )));

    _runAction(logger, es.createIndex, { type, version, suffix, mappings });
  })
  .command('delete', 'Delete an index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[suffix]', 'Index suffix if some')
  .action(({ type, version, suffix }, options, logger) => {
    _runAction(logger, es.deleteIndex, { type, version, suffix });
  })
  .command('analyze', 'Analyze an index.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('<field>', 'Field to analyze')
  .argument('<text>', 'Text for that field')
  .argument('[suffix]', 'Index suffix if some')
  .action(({ type, version, suffix, field, text }, options, logger) => {
    _runAction(logger, es.analyzeIndex, { type, version, suffix, field, text });
  })
  .command('pump', 'Pump a source items to an index.')
  .argument('<type>', 'Index type', PUMPABLE_INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[suffix]', 'Index suffix if some')
  .action(({ type, version, suffix }, options, logger) => {
    const pumpFunction = require(path.join(
      PUMPS_DIR,
      type + JS_EXT
    ));

    _runAction(logger, es.pumpToIndex, { type, version, suffix, pumpFunction });
  })
  .command('stats-fielddata', 'Retrieve field data usage stats.')
  .argument('[fields]', 'Fields to stats', FIELDS_REGEXP)
  .action(({ fields }, options, logger) => {
    _runAction(logger, es.statsFieldData, { fields });
  })
  .command('stats-nodes', 'Retrieve the nodes stats.')
  .action((unused, options, logger) => {
    _runAction(logger, es.nodeStats, {});
  })
  .command('stats-cluster', 'Retrieve the clusters stats.')
  .action((unused, options, logger) => {
    _runAction(logger, es.clusterStats, {});
  })
  .command('pending-tasks', 'Retrieve the pending tasks.')
  .action((unused, options, logger) => {
    _runAction(logger, es.pendingTasks, {});
  })
  .command('createTemplate', 'Create a template.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[suffixPattern]', 'Index suffix if some')
  .action(({ type, version, suffixPattern }, options, logger) => {
    const mappings = JSON.parse(fs.readFileSync(path.join(
      MAPPINGS_DIR,
      type + JSON_EXT
    )));
    let template = {};

    try {
      template = JSON.parse(fs.readFileSync(path.join(
        TEMPLATES_DIR,
        type + JSON_EXT
      )));
    } catch (err) {
      logger.error('No custom template found, using default one.');
    }

    _runAction(logger, es.createTemplate, { type, version, suffixPattern, mappings, template });
  })
  .command('deleteTemplate', 'Delete a template.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[suffixPattern]', 'Index suffix if some')
  .action(({ type, version, suffixPattern }, options, logger) => {
    _runAction(logger, es.createTemplate, { type, version, suffixPattern });
  })
  .command('mappings', 'Returns an index mappings.')
  .argument('<type>', 'Index type', INDEX_TYPE_REGEXP)
  .argument('<version>', 'New index version', INDEX_VERSION_REGEXP)
  .argument('[suffix]', 'Index suffix if some')
  .action(({ type, version, suffix, field, text }, options, logger) => {
    _runAction(logger, es.mappings, { type, version, suffix, field, text });
  })
  .command('settings', 'Retrieve the cluster settings.')
  .action((unused, options, logger) => {
    _runAction(logger, es.settings, {});
  })
  .command('state', 'Retrieve the cluster state.')
  .action((unused, options, logger) => {
    _runAction(logger, es.state, {});
  })
  .command('health', 'Retrieve the cluster health.')
  .action((unused, options, logger) => {
    _runAction(logger, es.health, {});
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
