import * as vscode from "vscode";

// --- Exported conversion function for testing ---
export function convert(
  text: string,
  enableJsonTagCheck: boolean = true
): { result: string; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { result: "", error: "Select a Go struct or TS interface." };
  }

  const isGo = /^\s*type\s+\w+\s+struct\b/i.test(trimmed);
  const isTS = /^\s*interface\s+\w+\b/i.test(trimmed);

  if (isGo) {
    if (enableJsonTagCheck) {
      const hasAllJsonTags = checkAllFieldsHaveJsonTags(trimmed);
      if (!hasAllJsonTags) {
        return { result: addMissingJsonTags(trimmed) };
      }
    }
    return { result: goStructToTSInterface(trimmed) };
  } else if (isTS) {
    return { result: tsInterfaceToGoStruct(trimmed) };
  }

  return { result: "", error: "Not a Go struct or TS interface." };
}

// --- Go → TS ---
function goStructToTSInterface(input: string): string {
  const lines = input.split("\n");
  let interfaceName = "Converted";

  const structMatch = lines[0]?.match(/type\s+(\w+)\s+struct/i);
  if (structMatch) {
    interfaceName = structMatch[1];
  }

  const tsFields: string[] = [];

  for (const line of lines) {
    if (line.trim() === "}" || line.trim() === "") {
      continue;
    }

    let fieldMatch = line.match(
      /^\s*(\w+)\s+([\w\[\]\*\.\{\}]+)\s+`json:"([^`]+)"`/
    );
    if (fieldMatch) {
      const [, fieldName, goType, jsonTag] = fieldMatch;
      const jsonParts = jsonTag.split(",");
      const tsName = jsonParts[0];
      const hasOmitEmpty =
        jsonParts.includes("omitempty") || jsonParts.includes("omitzero");

      const isArray = goType.startsWith("[]");
      const baseType = isArray ? goType.substring(2) : goType;
      const hasPointer = baseType.includes("*");

      let tsType = mapGoType(baseType, false);

      if (isArray) {
        tsType = `${tsType}[]`;
      }

      if (hasOmitEmpty || hasPointer) {
        tsType = `${tsType} | null`;
      }

      tsFields.push(`  ${tsName}${hasOmitEmpty ? "?" : ""}: ${tsType};`);
      continue;
    }

    fieldMatch = line.match(/^\s*(\w+)\s+([\w\[\]\*\.]+)/);
    if (fieldMatch) {
      const [, fieldName, goType] = fieldMatch;

      if (!/^[A-Z]/.test(fieldName)) {
        continue;
      }

      const tsName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
      const isArray = goType.startsWith("[]");
      const baseType = isArray ? goType.substring(2) : goType;
      const hasPointer = baseType.includes("*");

      let tsType = mapGoType(baseType, false);

      if (isArray) {
        tsType = `${tsType}[]`;
      }

      if (hasPointer) {
        tsType = `${tsType} | null`;
      }

      tsFields.push(`  ${tsName}${hasPointer ? "?" : ""}: ${tsType};`);
      continue;
    }
  }

  return `interface ${interfaceName} {\n${tsFields.join("\n")}\n}`;
}

// --- Add missing JSON tags to Go struct ---
function addMissingJsonTags(input: string): string {
  const lines = input.split("\n");
  const result: string[] = [];
  let inStruct = false;

  for (const line of lines) {
    if (/^\s*type\s+\w+\s+struct\b/.test(line)) {
      inStruct = true;
      result.push(line);
      continue;
    }

    if (inStruct && line.trim() === "}") {
      inStruct = false;
      result.push(line);
      continue;
    }

    if (
      inStruct &&
      /^\s*(\w+)\s+([\w\[\]\*\.]+)(\s*\/\/.*)?$/.test(line) &&
      !line.includes("json:")
    ) {
      const match = line.match(/^\s*(\w+)\s+([\w\[\]\*\.]+)(\s*\/\/.*)?$/);
      if (match) {
        const [, fieldName, fieldType, comment] = match;

        if (/^[A-Z]/.test(fieldName)) {
          const jsonName = toSnakeCase(fieldName);
          const fieldIndent = line.match(/^\s*/)?.[0] || "";
          const newLine = `${fieldIndent}${fieldName} ${fieldType} \`json:"${jsonName}"\`${
            comment ? " " + comment : ""
          }`;
          result.push(newLine);
          continue;
        }
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

function toCamelCase(str: string): string {
  return str
    .replace(/_([a-z])/g, (_, char) => char.toUpperCase())
    .replace(/^([a-z])/, (_, char) => char.toUpperCase());
}

function mapGoType(goType: string, isOptional: boolean = false): string {
  let cleanType = goType.replace(/\*/g, "");

  const map: Record<string, string> = {
    string: "string",
    int: "number",
    int8: "number",
    int16: "number",
    int32: "number",
    int64: "number",
    uint: "number",
    uint8: "number",
    uint16: "number",
    uint32: "number",
    uint64: "number",
    float32: "number",
    float64: "number",
    bool: "boolean",
    "time.Time": "string",
    "interface{}": "any",
    any: "any",
  };

  return cleanType in map ? map[cleanType] : cleanType;
}

// --- TS → Go ---
function tsInterfaceToGoStruct(input: string): string {
  const lines = input.split("\n");
  let structName = "Converted";

  const interfaceMatch = lines[0]?.match(/interface\s+(\w+)/i);
  if (interfaceMatch) {
    structName = interfaceMatch[1];
  }

  const goFields: string[] = [];

  for (const line of lines) {
    const fieldMatch = line.match(/^\s*(\w+)(\?)?\s*:\s*([\w\[\]]+);?/);
    if (!fieldMatch) {
      continue;
    }

    const [, tsName, isOptional, tsType] = fieldMatch;

    let goType = "interface{}";
    if (tsType.endsWith("[]")) {
      const elemType = reverseMapTsType(tsType.slice(0, -2));
      goType = `[]${elemType}`;
    } else {
      goType = reverseMapTsType(tsType);
    }

    const jsonTag = isOptional
      ? `json:"${tsName},omitempty"`
      : `json:"${tsName}"`;

    const goFieldName = toCamelCase(tsName);

    goFields.push(`\t${goFieldName} ${goType} \`${jsonTag}\``);
  }

  return `type ${structName} struct {\n${goFields.join("\n")}\n}`;
}

function reverseMapTsType(tsType: string): string {
  const map: Record<string, string> = {
    string: "string",
    number: "int",
    boolean: "bool",
    any: "any",
    unknown: "any",
  };
  return map[tsType] || tsType;
}

// Check if all struct fields have JSON tags
function checkAllFieldsHaveJsonTags(input: string): boolean {
  const lines = input.split("\n");
  let inStruct = false;

  for (const line of lines) {
    if (/^\s*type\s+\w+\s+struct\b/.test(line)) {
      inStruct = true;
      continue;
    }

    if (inStruct && line.trim() === "}") {
      inStruct = false;
      continue;
    }

    if (
      inStruct &&
      /^\s*(\w+)\s+([\w\[\]\*\.]+)/.test(line) &&
      !/json:/.test(line)
    ) {
      const fieldMatch = line.match(/^\s*(\w+)/);
      if (fieldMatch && /^[A-Z]/.test(fieldMatch[1])) {
        return false;
      }
    }
  }

  return true;
}

export function activate(context: vscode.ExtensionContext) {
  const convertSelection = vscode.commands.registerCommand(
    "go4lagetool.convert",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection).trim();

      const enableJsonTagCheck = vscode.workspace
        .getConfiguration("go4lagetool")
        .get("enableJsonTagCheck", true);

      const { result, error } = convert(text, enableJsonTagCheck);

      if (error) {
        if (error.includes("Select")) {
          vscode.window.showWarningMessage(error);
        } else {
          vscode.window.showErrorMessage(error);
        }
        return;
      }

      editor.edit((builder) => builder.replace(selection, result));
    }
  );

  const convertClipboard = vscode.commands.registerCommand(
    "go4lagetool.convertClipboard",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor.");
        return;
      }

      const enableJsonTagCheck = vscode.workspace
        .getConfiguration("go4lagetool")
        .get("enableJsonTagCheck", true);

      // Read from clipboard
      const clipboardText = await vscode.env.clipboard.readText();

      if (!clipboardText.trim()) {
        vscode.window.showWarningMessage("Clipboard is empty.");
        return;
      }

      const { result, error } = convert(clipboardText, enableJsonTagCheck);

      if (error) {
        vscode.window.showErrorMessage(error);
        return;
      }

      // Insert at cursor position (or replace selection if any)
      await editor.edit((builder) => {
        if (editor.selection.isEmpty) {
          builder.insert(editor.selection.active, result);
        } else {
          builder.replace(editor.selection, result);
        }
      });

      // Also update clipboard with converted result
      await vscode.env.clipboard.writeText(result);
    }
  );

  context.subscriptions.push(convertSelection, convertClipboard);
}

export function deactivate() {}
