# anescli

In my tool belt but use at your own risk.
There is no test currently and maybe never.

## Usage

```sh
npm i -g escli

anescli --help
```

Will print:
```
anescli 1.0.0

USAGE

  anescli <command> [options]

COMMANDS

 switch <type> <to> [from] [suffix]                    Switch an alias to another index.      
 pipe <type> <to> [from] [suffix]                      Copy an index content to another index.
 create <type> <version> [suffix]                      Create an index.                       
 delete <type> <version> [suffix]                      Delete an index.                       
 analyze <type> <version> <field> <text> [suffix]      Analyze an index.                      
 pump <type> <version> [suffix]                        Pump a source items to an index.       
 stats-fielddata [fields]                              Retrieve field data usage stats.       
 stats-nodes                                           Retrieve the nodes stats.              
 stats-cluster                                         Retrieve the clusters stats.           
 pending-tasks                                         Retrieve the pending tasks.            
 createTemplate <type> <version> [suffixPattern]       Create a template.                     
 deleteTemplate <type> <version> [suffixPattern]       Delete a template.                     
 mappings <type> <version> [suffix]                    Returns an index mappings.             
 settings                                              Retrieve the cluster settings.         
 state                                                 Retrieve the cluster state.            
 health                                                Retrieve the cluster health.           
 help <command>                                        Display help for a specific command    

GLOBAL OPTIONS

 -h, --help         Display help                                      
 -V, --version      Display version                                   
 --no-color         Disable colors                                    
 --quiet            Quiet mode - only displays warn and error messages
 -v, --verbose      Verbose mode - will also output debug messages
```

First of all create your config from the repo :
```sh
cp node_modules/anescli/config.example.js config.js
```

For the `create` command, you have to add mappings to use it:
```sh
mkdir mappings
cat "module.exports = a => a;" > mappings/myIndexType.js
```

For the `pipe` command, you can specify custom transformations:
```sh
mkdir transforms
cat "module.exports = a => a;" > transforms/myIndexType.js
```

For the `pump` command, you have to create the script that
 pump the various entries:
```sh
mkdir pumps
cat "module.exports = myPumpFunction;" > pumps/myIndexType.js
```

# Roadmap

- add `knifecycle`
- add tests
