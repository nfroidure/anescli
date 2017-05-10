# anescli

In my tool belt but use at your own risk.
There is no test currently and maybe never.

## Usage

```sh
npm i -g escli

anescli --help

#  anescli 1.0.0
#    
#  USAGE
#
#   bin.js <command> [options]
#
# COMMANDS
#
#   switch <type> <to> [from]                    Switch an alias to another index.      
#   pipe <type> <to> [from]                      Copy an index content to another index.
#   create <type> <version>                      Create an index.                       
#   delete <type> <version>                      Delete an index.                       
#   analyze <type> <version> <field> <text>      Analyze an index.                      
#   pump <type> <version>                        Pump a source items to an index.       
#   help <command>                               Display help for a specific command    
#
# GLOBAL OPTIONS
#
#   -h, --help         Display help                                      
#   -V, --version      Display version                                   
#   --no-color         Disable colors                                    
#   --quiet            Quiet mode - only displays warn and error messages
#   -v, --verbose      Verbose mode - will also output debug messages
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
