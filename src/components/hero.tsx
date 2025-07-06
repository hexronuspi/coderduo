"use client";

import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Divider, ButtonGroup, Tooltip } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import { Code, Lightbulb, Shuffle, Brain, MessageCircle, ChevronRight, Lock, CheckCircle2, Copy } from "lucide-react";
import { useState } from "react";

export function Hero() {
  const router = useRouter();
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
              Ace Your Coding Interviews with Coder Duo
            </h1>
            <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
              Level up your programming skills with our AI-powered coding practice platform. Solve real interview questions, get personalized hints, and build a standout resume.
            </p>
          </div>
          
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="flex justify-between items-center bg-gray-50 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <h3 className="font-medium">Two Sum Problem</h3>
              </div>
              <div className="flex items-center gap-2">
                <Chip size="sm" color="primary" variant="flat">Medium</Chip>
                <Tooltip content="Copy code">
                  <Button isIconOnly size="sm" variant="light">
                    <Copy size={16} />
                  </Button>
                </Tooltip>
              </div>
            </CardHeader>
            
            <CardBody className="p-0">
              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Given an array of integers <code className="bg-gray-100 px-1 py-0.5 rounded text-primary-700">nums</code> and an integer <code className="bg-gray-100 px-1 py-0.5 rounded text-primary-700">target</code>, return indices of the two numbers such that they add up to <code className="bg-gray-100 px-1 py-0.5 rounded text-primary-700">target</code>.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-5 mb-6">
                  <pre className="text-sm font-mono overflow-x-auto">
                    <code className="text-gray-800">
{`function twoSum(nums, target) {
  // Your solution here
}`}
                    </code>
                  </pre>
                </div>
                
                <div className="flex flex-wrap gap-3 mb-6">
                  <Button
                    color="primary"
                    variant={showHint ? "solid" : "light"}
                    startContent={<Lightbulb size={18} />}
                    onClick={() => {
                      setShowHint(!showHint);
                      setShowSolution(false);
                      setShowChat(false);
                    }}
                  >
                    {showHint ? "Hide Hint" : "Show Hint"}
                  </Button>
                  <Button
                    color="success"
                    variant={showSolution ? "solid" : "light"}
                    startContent={<CheckCircle2 size={18} />}
                    onClick={() => {
                      setShowSolution(!showSolution);
                      setShowHint(false);
                      setShowChat(false);
                    }}
                  >
                    {showSolution ? "Hide Solution" : "Show Solution"}
                  </Button>
                  <Button
                    color="secondary"
                    variant={showChat ? "solid" : "light"}
                    startContent={<MessageCircle size={18} />}
                    onClick={() => {
                      setShowChat(!showChat);
                      setShowHint(false);
                      setShowSolution(false);
                    }}
                  >
                    {showChat ? "Hide Chat" : "Ask AI"}
                  </Button>
                </div>
                
                {showHint && (
                  <Card className="mb-6 border-none bg-primary-50 shadow-sm">
                    <CardBody className="gap-4">
                      <h4 className="font-medium text-primary-700 flex items-center gap-2">
                        <Lightbulb size={18} />
                        Hints
                      </h4>
                      <div className="space-y-3">
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <p className="text-sm text-gray-700">1. Try using a hash map to keep track of values you've already seen.</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <p className="text-sm text-gray-700">2. For each number, check if its complement (target - current) exists in the hash map.</p>
                        </div>
                        <Button size="sm" variant="flat" color="primary" endContent={<ChevronRight size={14} />}>
                          Get more hints
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                )}
                
                {showSolution && (
                  <Card className="mb-6 border-none bg-success-50 shadow-sm">
                    <CardBody className="gap-4">
                      <h4 className="font-medium text-success-700 flex items-center gap-2">
                        <CheckCircle2 size={18} />
                        Solution
                      </h4>
                      <div className="bg-white rounded-lg p-4">
                        <pre className="text-sm font-mono overflow-x-auto">
                          <code className="text-gray-800">
{`function twoSum(nums, target) {
  const map = new Map();
  
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    
    map.set(nums[i], i);
  }
  
  return [];
}`}
                          </code>
                        </pre>
                      </div>
                      <p className="text-sm text-success-700">
                        This solution has O(n) time complexity and uses a hashmap for constant-time lookups.
                      </p>
                    </CardBody>
                  </Card>
                )}
                
                {showChat && (
                  <Card className="mb-6 border-none bg-secondary-50 shadow-sm">
                    <CardBody className="gap-4">
                      <h4 className="font-medium text-secondary-700 flex items-center gap-2">
                        <Brain size={18} />
                        AI Chat Helper
                      </h4>
                      
                      <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-500 italic mb-2">Ask me anything about this problem!</p>
                      </div>
                      
                      <div className="bg-secondary-100 p-3 rounded-lg shadow-sm">
                        <p className="text-sm font-medium mb-1">How can I optimize the time complexity?</p>
                        <p className="text-xs text-gray-500">You • Just now</p>
                      </div>
                      
                      <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-sm mb-1">
                          The optimal approach is using a hash map which gives O(n) time complexity. For each element, you check if its complement exists in the map. If not, add the current element to the map and continue. This way, you only need to iterate through the array once!
                        </p>
                        <p className="text-xs text-gray-500">AI Assistant • Just now</p>
                      </div>
                      
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Ask a question about this problem..." 
                          className="w-full py-2 px-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
                        />
                        <Button 
                          isIconOnly 
                          color="secondary" 
                          size="sm" 
                          aria-label="Send" 
                          className="absolute right-1 top-1"
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            </CardBody>
            
            <Divider />
            
            <CardFooter className="flex justify-between bg-gray-50 px-6 py-4">
              <Button variant="light" size="sm">Previous</Button>
              <ButtonGroup>
                <Button color="primary" variant="flat">Solve Similar</Button>
                <Button color="primary" endContent={<Shuffle size={16} />}>Random Question</Button>
              </ButtonGroup>
              <Button variant="light" size="sm">Next</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
