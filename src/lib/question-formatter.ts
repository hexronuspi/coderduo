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
export function formatSolution(solution: unknown): Record<string, unknown> {
  try {
    // If it's a string, try to parse it as JSON
    let solutionObj;
    try {
      solutionObj = typeof solution === 'string' ? JSON.parse(solution) : solution;
    } catch (parseError) {
      console.error('Error parsing solution JSON:', parseError);
      throw new Error('Invalid solution format');
    }
    
    // Create a structured format following the requested organization:
    // Theory, Brute Force, C++/Java/Python, Optimal, C++/Java/Python, Other, C++/Java/Python
    const formatted: Record<string, unknown> = {};
    let sectionIndex = 0; // For ordering sections
    
    // 1. Problem Analysis - Add explanation as the first section if it exists
    if (solutionObj.explanation) {
      formatted[`section_${sectionIndex++}`] = {
        sectionType: 'text',
        subsection: "Problem Analysis",
        text: solutionObj.explanation
      };
    }
    
    // 2. Theory section - handle both direct string and object with concepts
    if (solutionObj.theory) {
      formatted[`section_${sectionIndex++}`] = {
        sectionType: 'text',
        subsection: "Theoretical Background",
        text: typeof solutionObj.theory === 'string' 
          ? solutionObj.theory 
          : (solutionObj.theory.concepts ? solutionObj.theory.concepts : JSON.stringify(solutionObj.theory))
      };
    }
    
    // 3. Brute Force section - handle both string and object format
    if (solutionObj.bruteForce) {
      // If bruteForce is an object with approach and complexity
      if (typeof solutionObj.bruteForce === 'object') {
        // Add approach
        if (solutionObj.bruteForce.approach) {
          formatted[`section_${sectionIndex++}`] = {
            sectionType: 'text',
            subsection: "Brute Force Approach",
            text: solutionObj.bruteForce.approach
          };
        } else {
          // If no approach property but bruteForce is an object, stringify it
          formatted[`section_${sectionIndex++}`] = {
            sectionType: 'text',
            subsection: "Brute Force Approach",
            text: JSON.stringify(solutionObj.bruteForce)
          };
        }
        
        // Add complexity if available
        if (solutionObj.bruteForce.complexity) {
          const complexityText = typeof solutionObj.bruteForce.complexity === 'string'
            ? solutionObj.bruteForce.complexity
            : `Time Complexity: ${solutionObj.bruteForce.complexity.time || 'Not specified'}\nSpace Complexity: ${solutionObj.bruteForce.complexity.space || 'Not specified'}`;
            
          formatted[`section_${sectionIndex++}`] = {
            sectionType: 'text',
            subsection: "Brute Force Complexity",
            text: complexityText
          };
        }
        
        // Add brute force code implementations for C++/Java/Python if they exist inside bruteForce.code
        if (solutionObj.bruteForce.code) {
          // C++ implementation
          if (solutionObj.bruteForce.code.cpp) {
            formatted[`section_${sectionIndex++}`] = {
              sectionType: 'code',
              subsection: "C++ Brute Force Implementation",
              code: solutionObj.bruteForce.code.cpp,
              language: 'cpp'
            };
          }
          
          // Java implementation
          if (solutionObj.bruteForce.code.java) {
            formatted[`section_${sectionIndex++}`] = {
              sectionType: 'code',
              subsection: "Java Brute Force Implementation",
              code: solutionObj.bruteForce.code.java,
              language: 'java'
            };
          }
          
          // Python implementation
          if (solutionObj.bruteForce.code.python) {
            formatted[`section_${sectionIndex++}`] = {
              sectionType: 'code',
              subsection: "Python Brute Force Implementation",
              code: solutionObj.bruteForce.code.python,
              language: 'python'
            };
          }
        }
      } else {
        // If bruteForce is just a string
        formatted[`section_${sectionIndex++}`] = {
          sectionType: 'text',
          subsection: "Brute Force Approach",
          text: solutionObj.bruteForce
        };
      }
    }
    
    // 4. Optimal Solution section - handle both string and object format
    if (solutionObj.optimal) {
      // If optimal is an object with approach and complexity
      if (typeof solutionObj.optimal === 'object') {
        // Add approach
        if (solutionObj.optimal.approach) {
          formatted[`section_${sectionIndex++}`] = {
            sectionType: 'text',
            subsection: "Optimal Solution",
            text: solutionObj.optimal.approach
          };
        } else {
          // If no approach property but optimal is an object, stringify it
          formatted[`section_${sectionIndex++}`] = {
            sectionType: 'text',
            subsection: "Optimal Solution",
            text: JSON.stringify(solutionObj.optimal)
          };
        }
        
        // Add complexity if available
        if (solutionObj.optimal.complexity) {
          const complexityText = typeof solutionObj.optimal.complexity === 'string'
            ? solutionObj.optimal.complexity
            : `Time Complexity: ${solutionObj.optimal.complexity.time || 'Not specified'}\nSpace Complexity: ${solutionObj.optimal.complexity.space || 'Not specified'}`;
            
          formatted[`section_${sectionIndex++}`] = {
            sectionType: 'text',
            subsection: "Optimal Solution Complexity",
            text: complexityText
          };
        }
        
        // Add optimal code implementations for C++/Java/Python if they exist inside optimal.code
        if (solutionObj.optimal.code) {
          // C++ implementation
          if (solutionObj.optimal.code.cpp) {
            formatted[`section_${sectionIndex++}`] = {
              sectionType: 'code',
              subsection: "C++ Optimal Implementation",
              code: solutionObj.optimal.code.cpp,
              language: 'cpp'
            };
          }
          
          // Java implementation
          if (solutionObj.optimal.code.java) {
            formatted[`section_${sectionIndex++}`] = {
              sectionType: 'code',
              subsection: "Java Optimal Implementation",
              code: solutionObj.optimal.code.java,
              language: 'java'
            };
          }
          
          // Python implementation
          if (solutionObj.optimal.code.python) {
            formatted[`section_${sectionIndex++}`] = {
              sectionType: 'code',
              subsection: "Python Optimal Implementation",
              code: solutionObj.optimal.code.python,
              language: 'python'
            };
          }
        }
      } else {
        // If optimal is just a string
        formatted[`section_${sectionIndex++}`] = {
          sectionType: 'text',
          subsection: "Optimal Solution",
          text: solutionObj.optimal
        };
      }
    }
    
    // 5. Code section if it exists at the top level (fall back for old format)
    if (solutionObj.code && !solutionObj.bruteForce?.code && !solutionObj.optimal?.code) {
      // C++ implementation
      if (solutionObj.code.cpp) {
        formatted[`section_${sectionIndex++}`] = {
          sectionType: 'code',
          subsection: "C++ Implementation",
          code: solutionObj.code.cpp,
          language: 'cpp'
        };
      }
      
      // Java implementation
      if (solutionObj.code.java) {
        formatted[`section_${sectionIndex++}`] = {
          sectionType: 'code',
          subsection: "Java Implementation",
          code: solutionObj.code.java,
          language: 'java'
        };
      }
      
      // Python implementation
      if (solutionObj.code.python) {
        formatted[`section_${sectionIndex++}`] = {
          sectionType: 'code',
          subsection: "Python Implementation",
          code: solutionObj.code.python,
          language: 'python'
        };
      }
      
      // JavaScript implementation (if present)
      if (solutionObj.code.javascript) {
        formatted[`section_${sectionIndex++}`] = {
          sectionType: 'code',
          subsection: "JavaScript Implementation",
          code: solutionObj.code.javascript,
          language: 'javascript'
        };
      }
    }
    
    // 6. Handle complexity analysis separately if it exists at the top level
    if (solutionObj.complexity && !solutionObj.bruteForce?.complexity && !solutionObj.optimal?.complexity) {
      formatted[`section_${sectionIndex++}`] = {
        sectionType: 'text',
        subsection: "Complexity Analysis",
        text: typeof solutionObj.complexity === 'string' 
          ? solutionObj.complexity 
          : `Time Complexity: ${solutionObj.complexity.time || 'Not specified'}\nSpace Complexity: ${solutionObj.complexity.space || 'Not specified'}`
      };
    }
    
    // If we have no sections, add a fallback error message
    if (Object.keys(formatted).length === 0) {
      formatted.section_0 = {
        sectionType: 'text',
        subsection: "Solution",
        text: "No structured solution available. Try regenerating the solution."
      };
    }
    
    return formatted;
  } catch (e) {
    // If parsing fails, create a basic structure
    console.error("Error formatting solution:", e);
    return {
      section_0: {
        sectionType: 'text',
        subsection: "Error",
        text: "Could not parse solution. Please check the format or try regenerating it."
      }
    };
  }
}

