import { Card, CardBody, CardFooter, Button } from "@nextui-org/react";
import { BrainCircuit, BookOpen, Code, Lightbulb, ArrowRight, Sparkles, BarChart } from "lucide-react";

export function About() {
  return (
    <section id="about" className="py-20 md:py-28 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-100 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary-100 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      
      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-24">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 border border-primary-200 rounded-full bg-primary-50 text-primary-600 text-sm font-medium">
            <Sparkles className="w-4 h-4 mr-2" />
            Elevate your coding skills
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            About Coder Duo
          </h2>
          <p className="text-xl text-gray-600">
            We help developers ace their technical interviews with our comprehensive coding practice platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 bg-white overflow-hidden">
            <div className="h-1.5 bg-primary-500 w-full"></div>
            <CardBody className="p-8 gap-4">
              <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                <BrainCircuit className="w-7 h-7 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold">AI-Powered Assistance</h3>
              <p className="text-gray-600">
                Our AI coding helper provides smart suggestions and personalized feedback to improve your code.
              </p>
            </CardBody>
           
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 bg-white overflow-hidden">
            <div className="h-1.5 bg-secondary-500 w-full"></div>
            <CardBody className="p-8 gap-4">
              <div className="w-14 h-14 bg-secondary-100 rounded-xl flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 text-secondary-600" />
              </div>
              <h3 className="text-xl font-bold">Diverse Question Bank</h3>
              <p className="text-gray-600">
                Practice with both manually curated and AI-generated questions filtered by topic and difficulty.
              </p>
            </CardBody>
            
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 bg-white overflow-hidden">
            <div className="h-1.5 bg-success-500 w-full"></div>
            <CardBody className="p-8 gap-4">
              <div className="w-14 h-14 bg-success-100 rounded-xl flex items-center justify-center mb-4">
                <Lightbulb className="w-7 h-7 text-success-600" />
              </div>
              <h3 className="text-xl font-bold">Guided Hint-Based Solving</h3>
              <p className="text-gray-600">
                Get progressive hints that guide you toward solutions without giving away the answer.
              </p>
            </CardBody>
            
          </Card>
        </div>
        
      </div>
    </section>
  );
}
