#!/usr/bin/env node
/**
 * REST API Generator from Proto Definitions
 *
 * This script reads proto files and generates type-safe REST API methods
 * and React Query hooks.
 */

const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  protoDir: path.join(__dirname, "../protobuf/v1"),
  outputDir: path.join(__dirname, "../../src/wj-client/utils/generated"),
};

// HTTP method mapping based on gRPC method naming convention
function getHTTPMethod(methodName) {
  const upper = methodName.toUpperCase();
  if (
    upper.startsWith("CREATE") ||
    upper.startsWith("ADD") ||
    upper.startsWith("REGISTER")
  )
    return "post";
  if (upper.startsWith("UPDATE") || upper.startsWith("SET")) return "put";
  if (upper.startsWith("DELETE") || upper.startsWith("REMOVE")) return "delete";
  if (
    upper.startsWith("LIST") ||
    upper.startsWith("GET") ||
    upper.startsWith("FIND") ||
    upper.startsWith("VERIFY")
  )
    return "get";
  return "post";
}

// Convert PascalCase to camelCase
function toCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Store global type definitions map: protoFileName -> Set of type names
const globalTypeMap = new Map();

// Store global json_name mappings: protoFileName -> messageName -> { protoFieldName: jsonName }
const globalJsonNameMap = new Map();

// Parse google.api.http annotation from option lines
function parseHTTPAnnotation(lines, startIndex) {
  let result = { method: null, path: null, body: null };
  let braceCount = 0;
  let inAnnotation = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // Start of annotation block
    if (line.includes("option (google.api.http)")) {
      inAnnotation = true;
      const braceMatch = line.match(/\{/g);
      if (braceMatch) braceCount += braceMatch.length;
      const closeMatch = line.match(/\}/g);
      if (closeMatch) braceCount -= closeMatch.length;

      // Parse method/path/body from this line (handles single-line annotations like
      // `option (google.api.http) = { post: "/api/v1/price-alerts" body: "*" };`)
      const getMatch = line.match(/get:\s*["']([^"']+)["']/);
      const postMatch = line.match(/post:\s*["']([^"']+)["']/);
      const putMatch = line.match(/put:\s*["']([^"']+)["']/);
      const deleteMatch = line.match(/delete:\s*["']([^"']+)["']/);
      const bodyMatch = line.match(/body:\s*["']([^"']+)["']/);
      if (getMatch) result = { method: "get", path: getMatch[1], body: null };
      if (postMatch) result = { method: "post", path: postMatch[1], body: null };
      if (putMatch) result = { method: "put", path: putMatch[1], body: null };
      if (deleteMatch) result = { method: "delete", path: deleteMatch[1], body: null };
      if (bodyMatch) result.body = bodyMatch[1];

      if (braceCount <= 0) break;
      continue;
    }

    if (!inAnnotation) continue;

    // Count braces
    const openBraces = line.match(/\{/g);
    const closeBraces = line.match(/\}/g);
    if (openBraces) braceCount += openBraces.length;
    if (closeBraces) braceCount -= closeBraces.length;

    // Parse HTTP method and path
    const getMatch = line.match(/get:\s*["']([^"']+)["']/);
    const postMatch = line.match(/post:\s*["']([^"']+)["']/);
    const putMatch = line.match(/put:\s*["']([^"']+)["']/);
    const deleteMatch = line.match(/delete:\s*["']([^"']+)["']/);
    const bodyMatch = line.match(/body:\s*["']([^"']+)["']/);

    if (getMatch) result = { method: "get", path: getMatch[1], body: null };
    if (postMatch) result = { method: "post", path: postMatch[1], body: null };
    if (putMatch) result = { method: "put", path: putMatch[1], body: null };
    if (deleteMatch)
      result = { method: "delete", path: deleteMatch[1], body: null };
    if (bodyMatch) result.body = bodyMatch[1];

    // End of annotation
    if (braceCount <= 0) break;
  }

  return result;
}

// Parse proto file to extract service definitions
function parseProtoFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const services = [];
  let currentService = null;
  let currentComment = [];
  let pendingRPC = null; // For multi-line RPC definitions with options
  const fileName = path.basename(filePath, ".proto");

  // Initialize type set for this file
  if (!globalTypeMap.has(fileName)) {
    globalTypeMap.set(fileName, new Set());
  }
  const typeSet = globalTypeMap.get(fileName);

  // Store message field definitions: messageName -> array of {name, type, repeated, jsonName}
  const messageFieldsMap = new Map();
  // Store json_name mapping: messageName -> { protoFieldName: jsonName }
  const jsonNameMap = new Map();

  // First pass: extract all message definitions and their fields
  let currentMessage = null;
  for (const line of lines) {
    const trimmed = line.trim();
    const messageMatch = trimmed.match(/^message\s+(\w+)\s*{/);
    if (messageMatch) {
      const messageName = messageMatch[1];
      typeSet.add(messageName);
      currentMessage = messageName;
      messageFieldsMap.set(messageName, []);
      jsonNameMap.set(messageName, {});
      continue;
    }

    // End of message
    if (trimmed === "}" && currentMessage) {
      currentMessage = null;
      continue;
    }

    // Message field - match: [repeated] type name = number [json_name = "xxx"];
    if (currentMessage) {
      const repeatedMatch = trimmed.match(
        /^repeated\s+(\w+(?:\.\w+)*)\s+(\w+)\s*=\s*\d+/
      );
      const normalMatch = trimmed.match(/^(\w+(?:\.\w+)*)\s+(\w+)\s*=\s*\d+/);
      // Also capture json_name if present
      const jsonNameMatch = trimmed.match(/json_name\s*=\s*"([^"]+)"/);

      if (repeatedMatch) {
        const [, fieldType, fieldName] = repeatedMatch;
        const jsonName = jsonNameMatch ? jsonNameMatch[1] : null;
        messageFieldsMap
          .get(currentMessage)
          .push({ name: fieldName, type: fieldType, repeated: true, jsonName });
        if (jsonName) {
          jsonNameMap.get(currentMessage)[fieldName] = jsonName;
        }
      } else if (normalMatch) {
        const [, fieldType, fieldName] = normalMatch;
        const jsonName = jsonNameMatch ? jsonNameMatch[1] : null;
        messageFieldsMap.get(currentMessage).push({
          name: fieldName,
          type: fieldType,
          repeated: false,
          jsonName,
        });
        if (jsonName) {
          jsonNameMap.get(currentMessage)[fieldName] = jsonName;
        }
      }
    }
  }

  // Store jsonNameMap globally for use in path conversion
  globalJsonNameMap.set(fileName, jsonNameMap);

  // Second pass: extract service definitions
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Capture comments
    if (trimmed.startsWith("//")) {
      currentComment.push(trimmed.substring(2).trim());
      continue;
    }

    // Start of service
    const serviceMatch = trimmed.match(/service\s+(\w+)\s*{/);
    if (serviceMatch) {
      currentService = {
        name: serviceMatch[1],
        fileName: fileName,
        comment: currentComment.pop(),
        methods: [],
      };
      currentComment = [];
      pendingRPC = null;
      continue;
    }

    // RPC method start - handle both simple and fully qualified return types
    const rpcMatch = trimmed.match(
      /rpc\s+(\w+)\s*\(([^)]+)\)\s*returns\s*\(([^)]+)\)/
    );
    if (rpcMatch && currentService) {
      let [, name, requestType, responseType] = rpcMatch;
      // Extract just the type name from fully qualified types
      requestType = requestType.trim().split(".").pop();
      const originalResponseType = responseType.trim();
      responseType = responseType.trim().split(".").pop();

      // Determine the actual data type from the response type
      let dataType = inferDataTypeFromResponse(responseType, messageFieldsMap);

      // Store HTTP method info from annotation
      const httpInfo = parseHTTPAnnotation(lines, i);

      pendingRPC = {
        name,
        requestType,
        responseType,
        originalResponseType,
        dataType,
        comment: currentComment.pop(),
        httpMethod: httpInfo.method,
        httpPath: httpInfo.path,
        httpBody: httpInfo.body,
        protoFileName: fileName,
      };
      currentComment = [];
      continue;
    }

    // Closing brace of RPC method with options
    if (trimmed === "}" && pendingRPC && currentService) {
      currentService.methods.push(pendingRPC);
      pendingRPC = null;
      continue;
    }

    // End of service (only if no pending RPC)
    if (trimmed === "}" && !pendingRPC && currentService) {
      services.push(currentService);
      currentService = null;
      continue;
    }
  }

  return services;
}

// Infer the list field name from response type (e.g., ListWalletsResponse -> wallets)
function inferListFieldName(responseType) {
  // if (responseType === "ListUsersResponse") return "users";
  // if (responseType === "ListWalletsResponse") return "wallets";
  // Default pattern: List<Items>Response -> items
  const match = responseType.match(/List(\w+)Response/);
  if (match) {
    const itemName = match[1];
    // Convert to lowercase: Wallets -> wallets, Users -> users
    return itemName.charAt(0).toLowerCase() + itemName.slice(1);
  }
  return "items";
}

// Infer the data type based on response type name by parsing the message fields
function inferDataTypeFromResponse(responseType, messageFieldsMap) {
  const fields = messageFieldsMap.get(responseType);
  if (!fields || fields.length === 0) {
    return "void";
  }

  // Check for standard list response pattern: repeated <Item>s field + pagination field
  // const repeatedField = fields.find((f) => f.repeated);
  // const paginationField = fields.find(
  //   (f) => f.name === "pagination" || f.type.includes("PaginationResult")
  // );

  // if (repeatedField && paginationField) {
  //   // List response pattern: e.g., ListWalletsResponse has "repeated Wallet wallets" and "PaginationResult pagination"
  //   const itemsType = repeatedField.type.split('.').pop(); // Get just the type name
  //   return `{ items: ${itemsType}[]; pagination: PaginationResult }`;
  // }

  // Check for single item response pattern: data field
  const dataField = fields.find((f) => f.name === "data");
  if (dataField) {
    return dataField.type.split(".").pop(); // Get just the type name
  }

  // Check for special response like LoginResponse with token/user fields
  if (responseType === "LoginResponse") {
    const tokenField = fields.find(
      (f) => f.name === "token" || f.name === "accessToken"
    );
    const userField = fields.find((f) => f.name === "user");
    if (tokenField && userField) {
      return "LoginData";
    }
  }

  // No data field - might be a delete/void response
  const hasSuccessOnly = fields.length === 1 && fields[0].name === "success";
  const hasSuccessMessage =
    fields.length === 2 &&
    fields.some((f) => f.name === "success") &&
    fields.some((f) => f.name === "message");

  if (hasSuccessOnly || hasSuccessMessage) {
    return "void";
  }

  // Fallback: return 'unknown' if we can't determine the structure
  return "unknown";
}

// Get HTTP path based on method name (fallback if no annotation)
function getHTTPPath(serviceName, methodName) {
  const lcServiceName = toCamelCase(serviceName.replace("Service", ""));

  // Auth endpoints
  if (methodName === "Login") return `/api/v1/auth/login`;
  if (methodName === "Register") return `/api/v1/auth/register`;
  if (methodName === "Logout") return `/api/v1/auth/logout`;
  if (methodName === "VerifyAuth") return `/api/v1/auth/verify`;
  if (methodName === "GetAuth") return `/api/v1/auth/by-email`;

  // Wallet endpoints
  if (methodName === "GetWallet") return `/api/v1/wallets/:id`;
  if (methodName === "ListWallets") return `/api/v1/wallets`;
  if (methodName === "CreateWallet") return `/api/v1/wallets`;
  if (methodName === "UpdateWallet") return `/api/v1/wallets/:id`;
  if (methodName === "DeleteWallet") return `/api/v1/wallets/:id`;
  if (methodName === "AddFunds") return `/api/v1/wallets/:id/add`;
  if (methodName === "WithdrawFunds") return `/api/v1/wallets/:id/withdraw`;
  if (methodName === "TransferFunds") return `/api/v1/wallets/transfer`;

  // User endpoints
  if (methodName === "GetUser") return `/api/v1/users/:id`;
  if (methodName === "ListUsers") return `/api/v1/users`;
  if (methodName === "UpdateUser") return `/api/v1/users/profile`;
  if (methodName === "DeleteUser") return `/api/v1/users/:id`;
  if (methodName === "GetUserByEmail") return `/api/v1/users/by-email`;

  // Default pattern
  const httpMethod = getHTTPMethod(methodName);
  if (httpMethod === "get" && methodName.toLowerCase().startsWith("list")) {
    return `/api/v1/${lcServiceName}`;
  }
  return `/api/v1/${lcServiceName}/${toCamelCase(methodName)}`;
}

// Generate the API client code
function generateAPIClient(services) {
  const imports = new Set();
  const apiCode = [];

  apiCode.push(`// Auto-generated REST API Client from Protobuf Definitions`);
  apiCode.push(
    `// DO NOT EDIT - This file is generated by api/scripts/generate-rest-api.js`
  );
  apiCode.push(`// Generated at: ${new Date().toISOString()}`);
  apiCode.push("");
  apiCode.push(`import { apiClient } from "../api-client";`);
  apiCode.push(`import type { ResponseType } from "./hooks.types";`);
  apiCode.push("");

  // Generate imports - group by source file
  const importMap = new Map(); // protoFileName -> Set of types

  for (const service of services) {
    const protoFileName = service.fileName;
    if (!importMap.has(protoFileName)) {
      importMap.set(protoFileName, new Set());
    }
    const typeImports = importMap.get(protoFileName);

    for (const method of service.methods) {
      typeImports.add(method.requestType);
      // Also import the response type
      typeImports.add(method.responseType);

      // For Response wrapper methods, find where the data type is defined
      if (method.responseType === "Response" && method.dataType !== "unknown") {
        // Parse types like "PaginationResult<User>" -> "PaginationResult", "User"
        const types = method.dataType.match(/(\w+)/g);
        if (types) {
          types.forEach((t) => {
            // Find which proto file defines this type
            if (t === "PaginationResult" || t === "Money" || t === "Error") {
              // Common types
              if (!importMap.has("common")) {
                importMap.set("common", new Set());
              }
              importMap.get("common").add(t);
            } else {
              // Find which file defines this type
              for (const [file, typeSet] of globalTypeMap.entries()) {
                if (typeSet.has(t)) {
                  if (!importMap.has(file)) {
                    importMap.set(file, new Set());
                  }
                  importMap.get(file).add(t);
                  break;
                }
              }
            }
          });
        }
      } else if (
        method.responseType.endsWith("Response") &&
        method.dataType !== "unknown"
      ) {
        // For specific response types like GetUserResponse, also import the data type
        // Parse types like "{ items: User[]; pagination: PaginationResult }"
        const types = method.dataType.match(/\b(\w+)\b/g);
        if (types) {
          types.forEach((t) => {
            // Skip type names that are clearly TypeScript syntax
            if (
              t === "items" ||
              t === "pagination" ||
              t === "unknown" ||
              t === "void" ||
              t === "Promise"
            )
              return;

            if (t === "PaginationResult" || t === "Money" || t === "Error") {
              // Common types
              if (!importMap.has("common")) {
                importMap.set("common", new Set());
              }
              importMap.get("common").add(t);
            } else {
              // Find which file defines this type
              for (const [file, typeSet] of globalTypeMap.entries()) {
                if (typeSet.has(t)) {
                  if (!importMap.has(file)) {
                    importMap.set(file, new Set());
                  }
                  importMap.get(file).add(t);
                  break;
                }
              }
            }
          });
        }
      }
    }
  }

  // Generate import statements
  for (const [protoFileName, typeSet] of importMap.entries()) {
    if (typeSet.size > 0) {
      imports.add(
        `import type { ${Array.from(typeSet).join(
          ", "
        )} } from "@/gen/protobuf/v1/${protoFileName}";`
      );
    }
  }

  apiCode.push(...Array.from(imports));
  apiCode.push("");
  apiCode.push(
    `// ============================================================================`
  );
  apiCode.push(`// REST API CLIENT (Auto-generated)`);
  apiCode.push(
    `// ============================================================================`
  );
  apiCode.push("");

  // Generate API object
  apiCode.push(`export const api = {`);

  for (const service of services) {
    const apiName = toCamelCase(service.name.replace("Service", ""));
    apiCode.push(`  /**`);
    apiCode.push(`   * ${service.comment || service.name} API`);
    apiCode.push(`   */`);
    apiCode.push(`  ${apiName}: {`);

    for (const method of service.methods) {
      // Use parsed HTTP annotation if available, otherwise fallback
      const httpMethod = method.httpMethod || getHTTPMethod(method.name);
      const httpPath =
        method.httpPath || getHTTPPath(service.name, method.name);
      const httpBody = method.httpBody;
      // Use the actual protobuf response type
      const responseType = method.responseType;

      apiCode.push(`    /**`);
      apiCode.push(`     * ${method.comment || method.name}`);
      apiCode.push(`     * ${httpMethod.toUpperCase()} ${httpPath}`);
      apiCode.push(`     */`);
      // Return type uses the protobuf response type directly
      apiCode.push(
        `    async ${toCamelCase(method.name)}(request: ${
          method.requestType
        }): Promise<${responseType}> {`
      );

      // Check if path has path parameters (wrapped in {})
      const hasPathParams = httpPath.includes("{");

      if (hasPathParams) {
        // Convert proto path template to JS template string
        // Use json_name from proto to get correct property name: {walletId} or {wallet_id} -> walletId
        const pathTemplate = httpPath.replace(
          /\{(\w+)\}/g,
          (_match, p1) => {
            // Use the field name directly from the path (could be camelCase or snake_case)
            const protoFieldName = p1;
            // Try to look up the json_name from the proto definition
            const fileJsonNameMap = globalJsonNameMap.get(method.protoFileName);
            const messageJsonNameMap = fileJsonNameMap?.get(method.requestType);
            const jsonName = messageJsonNameMap?.[protoFieldName];
            // Use json_name if available, otherwise convert snake_case to camelCase
            let paramName = jsonName || protoFieldName;
            // If no json_name and field is snake_case, convert to camelCase (protoc-gen-ts_proto convention)
            if (!jsonName && protoFieldName.includes('_')) {
              paramName = protoFieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            }
            return `\${request.${paramName}}`;
          }
        );

        if (httpMethod === "get" || httpMethod === "delete") {
          apiCode.push(`      const endpoint = \`${pathTemplate}\`;`);
          apiCode.push(
            `      return apiClient.${httpMethod}(endpoint) as unknown as ${responseType};`
          );
        } else {
          // POST/PUT with path params
          if (httpBody === "*") {
            apiCode.push(`      const endpoint = \`${pathTemplate}\`;`);
            apiCode.push(
              `      return apiClient.${httpMethod}(endpoint, request) as unknown as ${responseType};`
            );
          } else if (httpBody) {
            apiCode.push(`      const endpoint = \`${pathTemplate}\`;`);
            apiCode.push(
              `      const body = { ${httpBody}: request.${httpBody} };`
            );
            apiCode.push(
              `      return apiClient.${httpMethod}(endpoint, body) as unknown as ${responseType};`
            );
          } else {
            // No body specified, send empty body
            apiCode.push(`      const endpoint = \`${pathTemplate}\`;`);
            apiCode.push(
              `      return apiClient.${httpMethod}(endpoint, {}) as unknown as ${responseType};`
            );
          }
        }
      } else {
        // No path params
        if (httpMethod === "get" || httpMethod === "delete") {
          // Build query params for GET/DELETE requests
          // Helper function to convert request to query params with enum handling
          apiCode.push(`      function toQueryParams(obj: any, parentKey = ''): string {`);
          apiCode.push(`        const params: string[] = [];`);
          apiCode.push(`        for (const [key, value] of Object.entries(obj)) {`);
          apiCode.push(`          if (value === undefined || value === null) continue;`);
          apiCode.push(`          if (typeof value === 'object' && !Array.isArray(value)) {`);
          apiCode.push(`            // For nested objects like 'filter' and 'pagination', flatten them`);
          apiCode.push(`            if (key === 'filter' || key === 'pagination') {`);
          apiCode.push(`              params.push(toQueryParams(value, ''));`);
          apiCode.push(`            } else {`);
          apiCode.push(`              params.push(toQueryParams(value, key));`);
          apiCode.push(`            }`);
          apiCode.push(`          } else {`);
          // Convert camelCase to snake_case for query params
          apiCode.push(`            // Convert camelCase to snake_case`);
          apiCode.push(`            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();`);
          apiCode.push(`            const fullKey = parentKey ? \`\${parentKey}.\${snakeKey}\` : snakeKey;`);
          // Convert enum values to simpler form for backend
          apiCode.push(`            let paramValue: string | number;`);
          apiCode.push(`            // For numeric enums, pass as-is (backend handles numeric values)`);
          apiCode.push(`            // For string enums (if any), convert to simplified form`);
          apiCode.push(`            if (typeof value === 'string') {`);
          apiCode.push(`              // Convert enum values like CATEGORY_TYPE_INCOME -> INCOME`);
          apiCode.push(`              paramValue = value`);
          apiCode.push(`                .replace(/^CATEGORY_TYPE_/, '')`);
          apiCode.push(`                .replace(/^TRANSACTION_TYPE_/, '')`);
          apiCode.push(`                .replace(/^SORT_FIELD_/, '');`);
          apiCode.push(`            } else if (typeof value === 'boolean') {`);
          apiCode.push(`              paramValue = value ? 'true' : 'false';`);
          apiCode.push(`            } else {`);
          apiCode.push(`              paramValue = value as string | number;`);
          apiCode.push(`            }`);
          apiCode.push(`            params.push(\`\${fullKey}=\${encodeURIComponent(paramValue)}\`);`);
          apiCode.push(`          }`);
          apiCode.push(`        }`);
          apiCode.push(`        return params.join('&');`);
          apiCode.push(`      }`);
          apiCode.push(`      const queryString = request ? toQueryParams(request) : '';`);
          apiCode.push(
            `      const endpoint = \`${httpPath}\${queryString ? \`?\${queryString}\` : ""}\`;`
          );
          apiCode.push(
            `      return apiClient.${httpMethod}(endpoint) as unknown as ${responseType};`
          );
        } else {
          if (httpBody === "*") {
            apiCode.push(
              `      return apiClient.${httpMethod}(\`${httpPath}\`, request) as unknown as ${responseType};`
            );
          } else if (httpBody) {
            apiCode.push(
              `      const body = { ${httpBody}: request.${httpBody} };`
            );
            apiCode.push(
              `      return apiClient.${httpMethod}(\`${httpPath}\`, body) as unknown as ${responseType};`
            );
          } else {
            // No body specified, send empty body for POST/PUT/PATCH
            apiCode.push(
              `      return apiClient.${httpMethod}(\`${httpPath}\`, {}) as unknown as ${responseType};`
            );
          }
        }
      }

      apiCode.push(`    },`);
      apiCode.push("");
    }

    apiCode.push(`  },`);
    apiCode.push("");
  }

  apiCode.push(`};`);
  apiCode.push("");
  apiCode.push(`export default api;`);

  return apiCode.join("\n");
}

// Generate React Query hooks
function generateReactQueryHooks(services) {
  const imports = new Set();
  const hooksCode = [];

  hooksCode.push(
    `// Auto-generated React Query Hooks from Protobuf Definitions`
  );
  hooksCode.push(
    `// DO NOT EDIT - This file is generated by api/scripts/generate-rest-api.js`
  );
  hooksCode.push(`// Generated at: ${new Date().toISOString()}`);
  hooksCode.push("");
  hooksCode.push(
    `import { useQuery, useMutation } from '@tanstack/react-query';`
  );
  hooksCode.push(`import { api } from './api';`);
  hooksCode.push(
    `import type { CustomUseQueryOptions, CustomUseMutationOptions, ErrorType, ResponseType } from './hooks.types';`
  );

  // Generate imports - group by source file
  const importMap = new Map(); // protoFileName -> Set of types

  for (const service of services) {
    const protoFileName = service.fileName;
    if (!importMap.has(protoFileName)) {
      importMap.set(protoFileName, new Set());
    }
    const typeImports = importMap.get(protoFileName);

    for (const method of service.methods) {
      typeImports.add(method.requestType);
      // Also import the response type
      typeImports.add(method.responseType);

      // For Response wrapper methods, find where the data type is defined
      if (method.responseType === "Response" && method.dataType !== "unknown") {
        // Parse types like "PaginationResult<User>" -> "PaginationResult", "User"
        const types = method.dataType.match(/(\w+)/g);
        if (types) {
          types.forEach((t) => {
            // Find which proto file defines this type
            if (t === "PaginationResult" || t === "Money" || t === "Error") {
              // Common types
              if (!importMap.has("common")) {
                importMap.set("common", new Set());
              }
              importMap.get("common").add(t);
            } else {
              // Find which file defines this type
              for (const [file, typeSet] of globalTypeMap.entries()) {
                if (typeSet.has(t)) {
                  if (!importMap.has(file)) {
                    importMap.set(file, new Set());
                  }
                  importMap.get(file).add(t);
                  break;
                }
              }
            }
          });
        }
      } else if (
        method.responseType.endsWith("Response") &&
        method.dataType !== "unknown"
      ) {
        // For specific response types like GetUserResponse, also import the data type
        // Parse types like "{ items: User[]; pagination: PaginationResult }"
        const types = method.dataType.match(/\b(\w+)\b/g);
        if (types) {
          types.forEach((t) => {
            // Skip type names that are clearly TypeScript syntax
            if (
              t === "items" ||
              t === "pagination" ||
              t === "unknown" ||
              t === "void" ||
              t === "Promise"
            )
              return;

            if (t === "PaginationResult" || t === "Money" || t === "Error") {
              // Common types
              if (!importMap.has("common")) {
                importMap.set("common", new Set());
              }
              importMap.get("common").add(t);
            } else {
              // Find which file defines this type
              for (const [file, typeSet] of globalTypeMap.entries()) {
                if (typeSet.has(t)) {
                  if (!importMap.has(file)) {
                    importMap.set(file, new Set());
                  }
                  importMap.get(file).add(t);
                  break;
                }
              }
            }
          });
        }
      }
    }
  }

  // Generate import statements
  for (const [protoFileName, typeSet] of importMap.entries()) {
    if (typeSet.size > 0) {
      imports.add(
        `import type { ${Array.from(typeSet).join(
          ", "
        )} } from "@/gen/protobuf/v1/${protoFileName}";`
      );
    }
  }

  hooksCode.push(...Array.from(imports));
  hooksCode.push("");
  hooksCode.push(
    `// ============================================================================`
  );
  hooksCode.push(`// REACT QUERY HOOKS (Auto-generated)`);
  hooksCode.push(
    `// ============================================================================`
  );
  hooksCode.push("");

  // Generate hooks for each service
  for (const service of services) {
    const apiName = toCamelCase(service.name.replace("Service", ""));
    hooksCode.push(`// ${service.comment || service.name} Hooks`);
    hooksCode.push("");

    for (const method of service.methods) {
      // Use parsed HTTP annotation if available, otherwise fallback
      const httpMethod = method.httpMethod || getHTTPMethod(method.name);
      const camelMethodName = toCamelCase(method.name);
      const queryConstant = `${
        apiName.charAt(0).toUpperCase() + apiName.slice(1)
      }${method.name}`;
      // Use the actual protobuf response type
      const responseType = method.responseType;
      // The data type from the response (what's inside the `data` field)
      const dataType =
        method.dataType !== "unknown" ? method.dataType : "unknown";

      hooksCode.push(`// Event name constants for ${method.name}`);
      hooksCode.push(
        `export const EVENT_${queryConstant} = "api.${apiName}.${camelMethodName}";`
      );
      hooksCode.push("");

      // Generate base async function
      hooksCode.push(`/**`);
      hooksCode.push(` * ${method.comment || method.name}`);
      hooksCode.push(` */`);
      hooksCode.push(
        `export async function ${camelMethodName}(request: ${method.requestType}): Promise<${responseType}> {`
      );
      hooksCode.push(
        `  return await api.${apiName}.${camelMethodName}(request);`
      );
      hooksCode.push(`}`);
      hooksCode.push("");

      // Generate useQuery hook (for GET requests)
      if (httpMethod === "get") {
        hooksCode.push(
          `export function useQuery${method.name}<TransformedType = ${responseType}>(`
        );
        hooksCode.push(`  payload: ${method.requestType},`);
        hooksCode.push(
          `  ops?: CustomUseQueryOptions<${responseType}, TransformedType>`
        );
        hooksCode.push(`) {`);
        hooksCode.push(
          `  return useQuery<${responseType}, ErrorType, TransformedType, any>({`
        );
        hooksCode.push(`    queryKey: [EVENT_${queryConstant}, payload],`);
        hooksCode.push(`    queryFn: async () => {`);
        hooksCode.push(`      return await ${camelMethodName}(payload);`);
        hooksCode.push(`    },`);
        hooksCode.push(`    retry: false,`);

        // Determine the select function based on dynamically inferred dataType
        if (dataType === "void") {
          // For responses without data, return undefined
          hooksCode.push(
            `    select: (response) => undefined as TransformedType,`
          );
        } else {
          hooksCode.push(
            `    select: (response) => response as TransformedType,`
          );
        }
        hooksCode.push(`    ...ops`);
        hooksCode.push(`  });`);
        hooksCode.push(`}`);
        hooksCode.push("");
      }

      // Generate useMutation hook (for all methods)
      hooksCode.push(
        `export function useMutation${method.name}(opts?: CustomUseMutationOptions<${responseType}, ${method.requestType}, any>) {`
      );
      hooksCode.push(
        `  return useMutation<${responseType}, ErrorType, ${method.requestType}, any>({`
      );
      hooksCode.push(`    mutationFn: async (request) => {`);
      hooksCode.push(`      return await ${camelMethodName}(request);`);
      hooksCode.push(`    },`);
      hooksCode.push(`    retry: false,`);
      hooksCode.push(`    ...opts`);
      hooksCode.push(`  });`);
      hooksCode.push(`}`);
      hooksCode.push("");
    }

    hooksCode.push("");
  }

  return hooksCode.join("\n");
}

// Main function
function main() {
  console.log(
    "🚀 Generating REST API client and React Query hooks from proto files..."
  );

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Read all proto files
  const protoFiles = fs
    .readdirSync(CONFIG.protoDir)
    .filter((f) => f.endsWith(".proto"));

  console.log(`📁 Found ${protoFiles.length} proto files`);

  // Parse all services from proto files
  const allServices = [];
  for (const file of protoFiles) {
    const filePath = path.join(CONFIG.protoDir, file);
    const services = parseProtoFile(filePath);
    allServices.push(...services);
    console.log(`  ✅ Parsed ${file}: ${services.length} service(s)`);
  }

  if (allServices.length === 0) {
    console.warn("⚠️  No services found in proto files!");
    process.exit(1);
  }

  // Generate the API client code
  const apiCode = generateAPIClient(allServices);
  const apiOutputFile = path.join(CONFIG.outputDir, "api.ts");
  fs.writeFileSync(apiOutputFile, apiCode);
  console.log(`✨ Generated API client: ${apiOutputFile}`);

  // Generate the React Query hooks code
  const hooksCode = generateReactQueryHooks(allServices);
  const hooksOutputFile = path.join(CONFIG.outputDir, "hooks.ts");
  fs.writeFileSync(hooksOutputFile, hooksCode);
  console.log(`✨ Generated React Query hooks: ${hooksOutputFile}`);

  console.log("");
  console.log("📦 Generated APIs:");
  for (const service of allServices) {
    console.log(
      `   - ${toCamelCase(service.name.replace("Service", ""))} (${
        service.methods.length
      } methods)`
    );
  }
}

main();
