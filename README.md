# AI Prompt Server Tools MCP Server

Node.js server implementing Model Context Protocol (MCP) for AI Prompt operations.

## Features

- Send Request to Prompt Server
- Get Prompt Info
 
**Note**:  

## API

### Resources

-  

### Tools

- **send_request_to_prompt_server**
  -  
  -  
  -  

- **get_prompt_info**
  -  
  -  
  -  

 

## Usage with 5ire Desktop
Command: npx -y @alexissinglaire/mcpfabrictools  <br>
Environment Variable: <br>
API_KEY: API key/token> <br>
API_VER_URL: host of API Server to verify the key using Header Auth method <br>
PROMPT_SERVER_URL: host of Prompt Server <br>


Note: your API server must return following json upon successfull verification. If the verification successfull, json apiKeyValid should set to true, else set to false.

 {
   "apiKeyValid": true
 }



### NPX

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@alexissinglaire/mcpfabrictools" 
      ]
    }
  }
}
```

## Build

Docker build:

```bash
docker build -t mcp/filesystem -f src/filesystem/Dockerfile .
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
