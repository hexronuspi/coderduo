/**
 * Question Formatter Library
 * 
 * This library provides functions for parsing and formatting programming questions
 * from various sources like LeetCode and CodeForces.
 */

// Types
export interface FormattedQuestion {
  title: string;
  description: string;
  examples: Example[];
  constraints: string[];
  notes?: string;
  difficulty?: string;
  tags?: string[];
}

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

/**
 * Parse a raw question text into a structured format
 * @param rawText The raw question text from LeetCode/CodeForces or similar platforms
 * @returns A formatted question object
 */
export function parseQuestionText(rawText: string): FormattedQuestion {
  // Check if the format appears to be from LeetCode
  if (rawText.includes("Input:") && rawText.includes("Output:") && 
      (rawText.includes("Example") || rawText.includes("Constraints"))) {
    return parseLeetCodeFormat(rawText);
  }
  // Check if the format appears to be from CodeForces
  else if (rawText.includes("Input") && rawText.includes("Output") && 
          (rawText.includes("Sample Input") || rawText.includes("Sample Output"))) {
    return parseCodeForcesFormat(rawText);
  }
  // Default to a generic parser
  else {
    return parseGenericFormat(rawText);
  }
}

/**
 * Parse LeetCode style question format
 */
function parseLeetCodeFormat(rawText: string): FormattedQuestion {
  const formatted: FormattedQuestion = {
    title: "",
    description: "",
    examples: [],
    constraints: []
  };

  // Extract title
  const titleMatch = rawText.match(/^(?:[\s\S]*?)(?=Given|Return|Find|You are|Write|Design|Implement)/i);
  if (titleMatch && titleMatch[1]) {
    formatted.title = titleMatch[1].trim();
  }

  // Extract description
  const descriptionMatch = rawText.match(/(?:Given|Return|Find|You are|Write|Design|Implement)[\s\S]*?(?=Example|Constraints|$)/i);
  if (descriptionMatch && descriptionMatch[0]) {
    formatted.description = descriptionMatch[0].trim();
  }

  // Extract examples
  const exampleBlocks = rawText.match(/Example \d+:[\s\S]*?(?=Example \d+:|Constraints:|$)/g);
  if (exampleBlocks) {
    exampleBlocks.forEach(block => {
      const inputMatch = block.match(/Input:? ([\s\S]*?)(?=Output|$)/i);
      const outputMatch = block.match(/Output:? ([\s\S]*?)(?=Explanation|Example|$)/i);
      const explanationMatch = block.match(/Explanation:? ([\s\S]*?)(?=Example|$)/i);

      if (inputMatch && outputMatch) {
        const example: Example = {
          input: inputMatch[1].trim(),
          output: outputMatch[1].trim()
        };
        
        if (explanationMatch) {
          example.explanation = explanationMatch[1].trim();
        }

        formatted.examples.push(example);
      }
    });
  }

  // Extract constraints
  const constraintsMatch = rawText.match(/Constraints:?\s*([\s\S]*?)(?=Note:|$)/i);
  if (constraintsMatch && constraintsMatch[1]) {
    const constraintsText = constraintsMatch[1].trim();
    formatted.constraints = constraintsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  // Extract notes if present
  const notesMatch = rawText.match(/Note:?\s*([\s\S]*?)$/i);
  if (notesMatch && notesMatch[1]) {
    formatted.notes = notesMatch[1].trim();
  }

  return formatted;
}

/**
 * Parse CodeForces style question format
 */
function parseCodeForcesFormat(rawText: string): FormattedQuestion {
  const formatted: FormattedQuestion = {
    title: "",
    description: "",
    examples: [],
    constraints: []
  };

  // Extract title
  const lines = rawText.split('\n');
  if (lines.length > 0) {
    formatted.title = lines[0].trim();
  }

  // Extract description - everything before the first "Input" or "Sample Input" section
  const descriptionMatch = rawText.match(/^(?:.*?\n)+?(?=Input:|Sample Input:)/i);
  if (descriptionMatch && descriptionMatch[0]) {
    // Remove the title from the description
    const description = descriptionMatch[0].replace(formatted.title, '').trim();
    formatted.description = description;
  }

  // Extract examples - CodeForces usually has "Sample Input" and "Sample Output"
  const sampleInputs = rawText.match(/Sample Input(?:[ \d]*)?:([\s\S]*?)(?=Sample Output|$)/gi);
  const sampleOutputs = rawText.match(/Sample Output(?:[ \d]*)?:([\s\S]*?)(?=Sample Input|$|Note:)/gi);

  if (sampleInputs && sampleOutputs && sampleInputs.length === sampleOutputs.length) {
    for (let i = 0; i < sampleInputs.length; i++) {
      const inputText = sampleInputs[i].replace(/Sample Input(?:[ \d]*)?:/i, '').trim();
      const outputText = sampleOutputs[i].replace(/Sample Output(?:[ \d]*)?:/i, '').trim();

      formatted.examples.push({
        input: inputText,
        output: outputText
      });
    }
  }

  // Extract constraints - CodeForces usually puts these in the Input section
  const constraintsMatch = rawText.match(/Input:([\s\S]*?)(?=Output:|$)/i);
  if (constraintsMatch && constraintsMatch[1]) {
    const constraintsText = constraintsMatch[1].trim();
    formatted.constraints = constraintsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  // Extract notes if present
  const notesMatch = rawText.match(/Note:([\s\S]*?)$/i);
  if (notesMatch && notesMatch[1]) {
    formatted.notes = notesMatch[1].trim();
  }

  return formatted;
}

/**
 * Parse a generic format for questions that don't match known patterns
 */
function parseGenericFormat(rawText: string): FormattedQuestion {
  const formatted: FormattedQuestion = {
    title: "",
    description: "",
    examples: [],
    constraints: []
  };

  // Split by double newlines to separate sections
  const sections = rawText.split(/\n\s*\n/);

  if (sections.length > 0) {
    // First section is likely the title and description
    const firstSection = sections[0];
    const lines = firstSection.split('\n');
    
    if (lines.length > 0) {
      formatted.title = lines[0].trim();
      formatted.description = lines.slice(1).join('\n').trim();
    }
  }

  // Look for examples (inputs and outputs)
  let exampleStarted = false;
  let currentExample: Partial<Example> = {};
  
  for (const line of rawText.split('\n')) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.match(/input/i) && !exampleStarted) {
      exampleStarted = true;
      currentExample = { input: "" };
      continue;
    }
    
    if (trimmedLine.match(/output/i) && currentExample.input !== undefined) {
      currentExample.output = "";
      continue;
    }
    
    if (exampleStarted) {
      if (currentExample.input !== undefined && currentExample.output === undefined) {
        currentExample.input += trimmedLine + '\n';
      } else if (currentExample.output !== undefined) {
        currentExample.output += trimmedLine + '\n';
      }
      
      // If we find another input or a constraint section, save the current example
      if ((trimmedLine.match(/input/i) && currentExample.output) || 
          trimmedLine.match(/constraints/i)) {
        if (currentExample.input && currentExample.output) {
          formatted.examples.push({
            input: currentExample.input.trim(),
            output: currentExample.output.trim()
          });
        }
        exampleStarted = trimmedLine.match(/input/i) ? true : false;
        currentExample = trimmedLine.match(/input/i) ? { input: "" } : {};
      }
    }
    
    // Look for constraints
    if (trimmedLine.match(/constraints/i)) {
      let constraintText = "";
      let constraintStarted = true;
      
      // Collect constraints until another major section is found
      for (const constraintLine of rawText.split('\n').slice(rawText.split('\n').indexOf(line) + 1)) {
        const trimmedConstraintLine = constraintLine.trim();
        
        if (trimmedConstraintLine.match(/example|input|output|note/i)) {
          constraintStarted = false;
          break;
        }
        
        if (constraintStarted && trimmedConstraintLine) {
          constraintText += trimmedConstraintLine + '\n';
        }
      }
      
      formatted.constraints = constraintText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }
  }

  // If we still have an incomplete example at the end, add it if complete
  if (currentExample.input && currentExample.output) {
    formatted.examples.push({
      input: currentExample.input.trim(),
      output: currentExample.output.trim()
    });
  }

  return formatted;
}

/**
 * Convert a formatted question to HTML representation
 */
export function formatQuestionToHTML(formattedQuestion: FormattedQuestion): string {
  let html = '';

  // Description
  html += `<div class="mb-6">${formattedQuestion.description}</div>`;

  // Examples
  if (formattedQuestion.examples.length > 0) {
    html += `<div class="mb-6">`;
    formattedQuestion.examples.forEach((example, index) => {
      html += `
        <div class="mb-4">
          <h3 class="text-lg font-semibold mb-2">Example ${index + 1}:</h3>
          <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-2">
            <p class="font-semibold">Input:</p>
            <pre class="whitespace-pre-wrap">${example.input}</pre>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <p class="font-semibold">Output:</p>
            <pre class="whitespace-pre-wrap">${example.output}</pre>
          </div>
          ${example.explanation ? `
            <div class="mt-2">
              <p class="font-semibold">Explanation:</p>
              <p>${example.explanation}</p>
            </div>
          ` : ''}
        </div>
      `;
    });
    html += `</div>`;
  }

  // Constraints
  if (formattedQuestion.constraints.length > 0) {
    html += `
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2">Constraints:</h3>
        <ul class="list-disc pl-6">
          ${formattedQuestion.constraints.map(constraint => `<li>${constraint}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Notes
  if (formattedQuestion.notes) {
    html += `
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2">Note:</h3>
        <p>${formattedQuestion.notes}</p>
      </div>
    `;
  }

  return html;
}

/**
 * Create a structured solution object
 * @param solution The solution text/code
 * @returns A properly formatted solution object
 */
export function formatSolution(solution: string): Record<string, unknown> {
  try {
    // If already a JSON, just return it
    return JSON.parse(solution);
  } catch (e) {
    // Otherwise create a structured solution
    console.log("Error", e)
    // Detect language from code
    const language = detectLanguage(solution);
    
    // Split solution into sections if any headers are found
    const sections = extractSolutionSections(solution);
    
    if (sections.length > 0) {
      // Create a structured solution with sections
      const formattedSolution: Record<string, unknown> = {};
      
      sections.forEach((section, index) => {
        formattedSolution[`section${index + 1}`] = section;
      });
      
      return formattedSolution;
    } else {
      // If no clear sections, create a basic structure
      return {
        section1: {
          subsection: "Solution Approach",
          text: extractExplanationText(solution),
          code: extractCode(solution),
          language
        }
      };
    }
  }
}

/**
 * Extract sections from a solution text based on headers
 */
function extractSolutionSections(solutionText: string): Array<{
  subsection?: string;
  text?: string;
  code?: string;
  language?: string;
}> {
  const sections: Array<{
    subsection?: string;
    text?: string;
    code?: string;
    language?: string;
  }> = [];

  // Pattern for section headers (## Header, # Header, or just Header:)
  const headerPattern = /(^|\n)(#{1,3}|[A-Z][A-Za-z\s]+:)/g;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerPattern.exec(solutionText)) !== null) {
    matches.push(match);
  }
  
  if (matches.length === 0) {
    // No headers found, treat as a single section
    const code = extractCode(solutionText);
    const text = extractExplanationText(solutionText);
    const language = detectLanguage(code);
    
    if (code || text) {
      sections.push({
        subsection: "Solution",
        text: text || undefined,
        code: code || undefined,
        language: code ? language : undefined
      });
    }
    
    return sections;
  }
  
  // Add indices to split on
  const splitIndices = matches.map(match => match.index);
  splitIndices.push(solutionText.length);
  
  // Split content based on header positions
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIndex = match.index!;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : solutionText.length;
    
    const sectionContent = solutionText.substring(startIndex, endIndex);
    
    // Get the subsection title by removing the markdown symbols
    const subsectionTitle = match[0].replace(/^#+\s+/, '').replace(/:\s*$/, '').trim();
    
    // Extract text and code from this section
    const sectionCode = extractCode(sectionContent);
    const sectionText = extractExplanationText(sectionContent).replace(subsectionTitle, '').trim();
    const language = detectLanguage(sectionCode);
    
    sections.push({
      subsection: subsectionTitle,
      text: sectionText || undefined,
      code: sectionCode || undefined,
      language: sectionCode ? language : undefined
    });
  }
  
  return sections;
}

/**
 * Extract code blocks from text
 */
function extractCode(text: string): string {
  // Look for code blocks with triple backticks
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const codeBlocks: string[] = [];
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push(codeMatch[1].trim());
  }
  
  if (codeBlocks.length > 0) {
    return codeBlocks.join('\n\n');
  }
  
  // Check for code that's indented by at least 4 spaces or 1 tab
  const indentedCodeRegex = /(^[ \t]{4,}[^\n]+\n?)+/gm;
  const indentedBlocks: string[] = [];
  const indentedMatches = Array.from(text.matchAll(indentedCodeRegex));
  // matchAll returns an iterator, so we convert it to an array for compatibility
  for (const match of indentedMatches) {
    indentedBlocks.push(match[0].trim());
  }
  
  if (indentedBlocks.length > 0) {
    return indentedBlocks.join('\n\n');
  }
  
  // Try to find code by looking for common programming patterns
  const lines = text.split('\n');
  const possibleCode = lines.filter(line => 
    /[{}();=]/.test(line) || 
    /\b(function|class|if|for|while|return|var|let|const|def|import|from)\b/.test(line)
  ).join('\n');
  
  return possibleCode || '';
}

/**
 * Extract explanation text from a solution
 */
function extractExplanationText(text: string): string {
  // Remove code blocks
  let cleanText = text.replace(/```(?:\w+)?\n[\s\S]*?```/g, '');
  
  // Remove indented code blocks
  cleanText = cleanText.replace(/(^[ \t]{4,}[^\n]+\n?)+/gm, '');
  
  // Clean up the remaining text
  return cleanText.trim();
}

/**
 * Detect programming language from code
 */
function detectLanguage(code: string): string {
  if (!code) return 'javascript'; // Default
  
  if (code.includes('func ') || code.includes('package main')) {
    return 'go';
  } else if (code.includes('public class') || code.includes('public static void main')) {
    return 'java';
  } else if (code.includes('def ') && code.includes(':')) {
    return 'python';
  } else if (code.includes('#include <') || code.includes('int main()')) {
    return 'cpp';
  } else if (code.includes('fn ') || code.includes('struct ') || code.includes('impl ')) {
    return 'rust';
  } else if (code.includes('<?php') || code.includes('namespace ')) {
    return 'php';
  } else if (code.includes('using System;') || code.includes('namespace ') || code.includes('public class')) {
    return 'csharp';
  } else if (code.includes('type ') && (code.includes('interface ') || code.includes('struct {'))) {
    return 'typescript';
  } else {
    // Default to JavaScript if no clear indicators
    return 'javascript';
  }
}
