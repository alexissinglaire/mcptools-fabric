#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from 'os';
import { StringValidation, z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { diffLines, createTwoFilesPatch } from 'diff';
import { minimatch } from 'minimatch';

import fetch from 'node-fetch';  // Import node-fetch

import { Logger } from './type.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

interface ApiKeyVerificationResponse {
  apiKeyValid: boolean;
  // Add other expected properties if your API response has them
}

interface FabricGetPatternInfoResponse {
  Name: string;
  Description: String;
  Pattern: String;
}

interface FabricResponse {
  type: string;
  format: String;
  content: String;
}

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: mcp-fabric-tools ");
  process.exit(1);
}

const log = (...args: any[]) => console.log('[mcpfabrictools]', ...args)
const logStderr = (...args: any[]) => console.error('[mcpfabrictools]', ...args)

const noneLogger: Logger = {
  info: () => {},
  error: () => {},
}


const getLogger = ({
  logLevel,
  outputTransport,
}: {
  logLevel: string
  outputTransport: string
}): Logger => {
  if (logLevel === 'none') {
    return noneLogger
  }

  if (outputTransport === 'stdio') {
    return { info: logStderr, error: logStderr }
  }

  return { info: log, error: logStderr }
}

const argv = yargs(hideBin(process.argv))
  .option('logLevel', {
    choices: ['info', 'none'] as const,
    default: 'info',
    description: 'Logging level',
  })

  .help()
  .parseSync()


const logger = getLogger({
  logLevel: argv.logLevel,
  outputTransport: argv.outputTransport as string,
})

logger.info('Starting...')
logger.info(
  'welcome to mcp server for fabric tools',
)

var API_KEY: string = process.env.API_KEY ?? 'xxx';

var PROMPT_SERVER_URL: string = process.env.PROMPT_SERVER_URL ?? 'http://localhost:18187';
var API_VER_URL: string = process.env.API_VER_URL ?? 'http://localhost';

//console.error("Env variable for API_KEY: ", API_KEY);

//** uncomment these area if you need your API server to validate your API key/token */
//**API key/token is taken from environment variable API_KEY */
//**API server URL is token from environment variable API_VER_URL*/
const isApiKeyValid = await verifyApiKey(API_VER_URL, API_KEY);
if (!isApiKeyValid) {
    console.error('Invalid API_KEY. Server cannot start.');
    process.exit(1);
}

async function verifyApiKey(verificationUrl:string, apiKey: string): Promise<boolean> {
   
  try {
    const response = await fetch(verificationUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey, // Sending API key in the header
        'Content-Type': 'application/json',
        'API_KEY': apiKey,
      },
    });

    if (response.ok) {
       
      const result = (await response.json()) as ApiKeyVerificationResponse; // Cast the result
       return result.apiKeyValid; // Assuming the server returns { isValid: true/false }
    } else {
       console.error(`API Key verification failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Error verifying API Key:', error);
    return false;
  }
}

// Schema definitions
const FabricSendRequestArgsSchema = z.object({
  user_input: z.string(),
  pattern_name: z.string(),
});

const FabricGetPatternInfoArgsSchema = z.object({
  pattern_name: z.string(),
});


const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

interface FileInfo {
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  permissions: string;
}



// Server setup
const server = new Server(
  {
    name: "secure-filesystem-server",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool implementations
 
async function fabricGetPatternInfo(patternName: string): Promise<String> {
  const getpatterninfoUrl = PROMPT_SERVER_URL + "/patterns/" + patternName;
  logger.info('inside async function fabricGetPatternInfo')
  try {
    const response = await fetch(getpatterninfoUrl, {
      method: 'GET',
      headers: {
         
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
       
        const result = (await response.json()) as FabricGetPatternInfoResponse; // Cast the result
        
        return String(result.Pattern);
    } else {
        console.error(`Get prompt info failed: ${response.status}`);
       
        return "response not okay";
    }
  } catch (error) {
      console.error('Error retrieving Fabric Pattern Info:', error);
      
      return "error retrieving pattern info, check your Fabric server status";   
  }

  
}

async function processServerResponse(rawResponse: string): Promise<String> {
  // Split the response by the "data: " prefix
  const parts = rawResponse.split('data: ');

  // Filter out any empty strings that might result from the split
  const jsonStrings = parts.filter(part => part.trim() !== '');

  // Parse each valid JSON string
  const responses = jsonStrings.map(jsonString => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error parsing JSON:', error, jsonString);
      return null; // Or handle the error as needed
    }
  }).filter(response => response !== null); // Filter out any failed parses

  // Now you have an array of parsed JSON objects (responses)
  console.log('Parsed Responses:', responses);

  var content; 

  // Process each parsed response
  responses.forEach(response => {
    if (response) {
      if (response.type === 'content') {
        console.log('Content Data:', response.content);
        content = response.content;
        // Further processing for content type
      } else if (response.type === 'complete') {
        console.log('Complete Data:', response.content);
        // Further processing for complete type
      } else {
        console.log('Unknown Response Type:', response);
      }
    }
  });

  return String(content);
}

async function fabricSendRequest(userInput: string, patternName: string): Promise<String> {
  const getpatterninfoUrl = PROMPT_SERVER_URL + "/chat";
  logger.info('inside async function fabricSendRequest')
  try {
    const requestBody = {
      prompts: [
        {
          userInput: userInput,
          patternName: patternName,
        },
      ],
    };

    const response = await fetch(getpatterninfoUrl, {
      method: 'POST',
      headers: {
         
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody), // Add the JSON body to the request
    });

    if (response.ok) {
      console.error("goes here - 1");
      const rawData = (await response.text());
      const responseData = await processServerResponse(rawData); 
      return String("response: " + responseData);
    } else {
      console.error("goes here - 2");
      console.error(`Send request failed with status: ${response.status}`);
       
      return "response not okay";
    }
  } catch (error) {
    console.error('error sending request to Prompt Server, check your Fabric server status: ', error);
     
    return "error sending request to Prompt Server, check your Fabric server status: " + error;   
  }

  
}


// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "send_request_to_prompt_server",
        description:
          "Send request message to Fabric server. " +
          "Handle processing user input using the given prompt name by Fabric server.",  
        inputSchema: zodToJsonSchema(FabricSendRequestArgsSchema) as ToolInput,
      },
      {
        name: "get_prompt_info",
        description:
          "Get AI prompt information from Prompt server. " +
          "Handles request to get AI prompt info from Prompt Server.",  
        inputSchema: zodToJsonSchema(FabricGetPatternInfoArgsSchema) as ToolInput,
      }
       
    ],
  };
});


server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "send_request_to_prompt_server": {
        const parsed = FabricSendRequestArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for send_request_to_prompt_server: ${parsed.error}`);
        }
        const validUserInput = parsed.data.user_input;
        const validPatternName = parsed.data.pattern_name;
        const responseMessage = await fabricSendRequest(validUserInput, validPatternName);
        return {
          content: [{ type: "text", text: "done: " + responseMessage  }],
        }; 
      }
        
      case "get_prompt_info": { 
        logger.info('inside case fabric_get_pattern_info')
        const parsed = FabricGetPatternInfoArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_prompt_info: ${parsed.error}`);
        }
         
        const validPatternName = parsed.data.pattern_name;  
        const responsePatternInfo = await fabricGetPatternInfo(validPatternName);
         
        return {
          content: [{ type: "text", text: responsePatternInfo}],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server for Prompt Server tools running on stdio");
   
  console.error("[Environment Variable] API_KEY: ", API_KEY);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});