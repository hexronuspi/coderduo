"use client";

import { Question } from "@/components/question-bank/question-bank";
import { parseQuestionText, formatSolution } from "./question-formatter";

/**
 * Process a question from the database for optimal display
 * @param rawQuestion The raw question from the database
 * @returns Processed question ready for display
 */
export function processQuestion(rawQuestion: Question): Question {
  try {
    const processedQuestion = { ...rawQuestion };
    
    // Parse the question text if it exists
    // if (rawQuestion.question) {
    //   const parsedQuestion = parseQuestionText(rawQuestion.question);
    //   // Keep the original question text in the database format
    //   // The frontend will use the parsed version for display
    // }

    // Process the solution if it exists and is not already JSON
    if (rawQuestion.solution) {
      try {
        // Check if it's already valid JSON
        JSON.parse(rawQuestion.solution);
        // If it parses successfully, no need to do anything
      } catch (e) {
        // If it fails to parse, format it properly
        console.log("Error:", e)
        const formattedSolution = formatSolution(rawQuestion.solution);
        processedQuestion.solution = JSON.stringify(formattedSolution);
      }
    }

    return processedQuestion;
  } catch (error) {
    console.error("Error processing question:", error);
    return rawQuestion; // Return original if processing fails
  }
}

/**
 * Format a raw question text into proper question object for database storage
 * @param title The title of the question
 * @param rawText The raw question text (from LeetCode, CodeForces, etc.)
 * @param difficulty Optional difficulty level
 * @param tags Optional tags
 * @returns A formatted question ready for database storage
 */
export function createQuestionFromRawText(
  title: string, 
  rawText: string, 
  difficulty?: string, 
  tags?: string[]
): Omit<Question, 'id'> {
  // Parse the question
  const parsedQuestion = parseQuestionText(rawText);
  
  // Format as HTML for storage
  // const formattedHTML = `
  //   <div>
  //     <p>${parsedQuestion.description}</p>
      
  //     ${parsedQuestion.examples.map((example, index) => `
  //       <div>
  //         <h3>Example ${index + 1}:</h3>
  //         <div>
  //           <p><strong>Input:</strong> ${example.input}</p>
  //           <p><strong>Output:</strong> ${example.output}</p>
  //           ${example.explanation ? `<p><strong>Explanation:</strong> ${example.explanation}</p>` : ''}
  //         </div>
  //       </div>
  //     `).join('')}
      
  //     ${parsedQuestion.constraints.length > 0 ? `
  //       <div>
  //         <h3>Constraints:</h3>
  //         <ul>
  //           ${parsedQuestion.constraints.map(constraint => `<li>${constraint}</li>`).join('')}
  //         </ul>
  //       </div>
  //     ` : ''}
      
  //     ${parsedQuestion.notes ? `
  //       <div>
  //         <h3>Note:</h3>
  //         <p>${parsedQuestion.notes}</p>
  //       </div>
  //     ` : ''}
  //   </div>
  // `;
  
  return {
    title: title || parsedQuestion.title,
    question: rawText, // Store the original raw text
    hint: [],
    solution: '',
    difficulty: difficulty || 'Medium',
    tags: tags || []
  };
}
