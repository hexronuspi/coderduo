"use client";
import { 
  Card, CardBody, CardHeader, Divider, Button, 
  Avatar, Chip, Tab, Tabs, Modal, ModalContent, 
  ModalHeader, ModalBody, ModalFooter, Input, Dropdown, 
  DropdownTrigger, DropdownMenu, DropdownItem, Badge,
  Tooltip, Progress
} from "@nextui-org/react";
import { 
  LogOut, Code, List, Settings, BookOpen, Home,
  BookOpen as BookIcon, GraduationCap, Menu, ChevronDown,
  CreditCard, User, Star, Edit, Plus, CheckCircle2,
  Zap, Package,
  CreditCardIcon
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import QuestionBank from "@/components/question-bank/question-bank";
import Link from "next/link";
import { Plan } from "@/types/subscription";
import { fetchCreditPacks } from "@/lib/subscription";
import { useRouter } from "next/navigation";
import { CreditModal } from "@/components/credit/credit-modal";
import { useToast } from "@/components/ui/toast";

// Question Bank Section component for the dashboard
interface QuestionBankSectionProps {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
}

const QuestionBankSection = ({ supabase }: QuestionBankSectionProps) => {
  return (
    <div className="flex flex-col gap-4">
      <QuestionBank supabase={supabase} />
    </div>
  );
};

export default function Dashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [username, setUsername] = useState("coderduo");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isFreeUser, setIsFreeUser] = useState(true);
  const [credits, setCredits] = useState(0);
  const [displayName, setDisplayName] = useState("coderduo");
  const [tempName, setTempName] = useState("coderduo");
  const [selectedCreditPackId, setSelectedCreditPackId] = useState<string | null>(null);
  const [creditPacks, setCreditPacks] = useState<Plan[]>([]);
  const [userId, setUserId] = useState<string>("");
  
  // Initialize the toast utilities
  const { success, error, warning, info, ToastContainer } = useToast();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Function to fetch user profile data from users table
  const fetchUserProfile = async (userId: string) => {
    try {
      // Get current user data to get email
      const { data: authData } = await supabase.auth.getUser();
      
      if (authData?.user?.email) {
        setUserEmail(authData.user.email);
      }
      
      // Fetch additional user data from the database
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Error fetching user profile:", error);
        return;
      }
      
      if (data) {
        const userData = data as any;
        setUsername(userData.name || "");
        // Check if user has credits - determines if they are still on free plan
        const userCredits = userData.credits || 0;
        setIsFreeUser(userCredits <= 3); // Free users have 3 or fewer credits
        setCredits(userCredits);
        setDisplayName(userData.name || "Coder"); // Default name if not set
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  };
  
  useEffect(() => {
    if (!supabase) return;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth');
        setUserEmail(null);
      }
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user?.id) {
          setUserId(session.user.id);
          
          // Set email directly from session if available
          if (session.user.email) {
            setUserEmail(session.user.email);
          }
          
          fetchUserProfile(session.user.id);
        }
      }
    });
    
    // Fetch credit packs
    const loadCreditPacks = async () => {
      try {
        const packs = await fetchCreditPacks();
        setCreditPacks(packs);
      } catch (err) {
        console.error("Error fetching credit packs:", err);
      }
    };
    
    loadCreditPacks();
    
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        
        // Set email directly from session if available
        if (session.user.email) {
          setUserEmail(session.user.email);
        }
        
        fetchUserProfile(session.user.id);
      } else {
        router.push('/auth');
      }
    };
    
    getInitialSession();

    // Clean up subscription
    return () => {
      subscription?.unsubscribe();
    };
  }, [router, supabase]);

  // Function to handle sign out
  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      if (!supabase) {
        throw new Error("Supabase client not available");
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        throw error;
      } 
      
      console.log("User signed out successfully");
      router.push('/');
    } catch (err) {
      console.error("Error during sign out:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Functions for the profile modal
  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);
  
  // Functions for credit modal
  const openCreditModal = () => {
    // Check if Razorpay is loaded
    if (!(window as any).Razorpay) {
      console.warn("Razorpay is not loaded, attempting to load it now...");
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        console.log("Razorpay loaded successfully");
        setIsCreditModalOpen(true);
      };
      script.onerror = () => {
        console.error("Failed to load Razorpay");
        alert("Payment system is not available. Please refresh the page and try again.");
      };
      document.body.appendChild(script);
    } else {
      console.log("Razorpay already loaded");
      setIsCreditModalOpen(true);
    }
  };
  const closeCreditModal = () => setIsCreditModalOpen(false);
  
  const handleNameChange = (value: string) => {
    setDisplayName(value);
  };
  
  // Function to buy credits with specific pack selection
  const buyCredits = (packId?: string) => {
    // Find the matching credit pack or use the default one
    if (packId) {
      setSelectedCreditPackId(packId);
    }
    
    // Open the credit modal
    openCreditModal();
  };
  
  // Function to handle credit updates from the modal
  const handleCreditUpdate = (newCredits: number) => {
    setCredits(newCredits);
    setIsFreeUser(newCredits <= 3);
    
    // Show a success toast notification
    success(
      "Credits Updated", 
      `Your account has been credited. You now have ${newCredits} credits.`
    );
    
    // Close the credit modal if it's still open
    closeCreditModal();
  };

  // Function to save profile changes
  const saveProfile = async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: displayName })
        .eq('id', userId);
        
      if (error) {
        console.error("Error updating profile:", error);
        // Optionally, show an error message to the user
        return;
      }
      
      setUsername(displayName); // Update local state to reflect change immediately
      closeProfileModal();
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
  };

  // Function to render credit badge
  const renderCreditBadge = () => {
    if (isFreeUser) {
      return (
        <Chip
          variant="flat"
          color="default"
          className="text-xs font-medium"
        >
          FREE PLAN
        </Chip>
      );
    } else {
      return (
        <Chip
          startContent={<CreditCardIcon size={12} />}
          variant="flat"
          color="primary"
          className="text-xs font-medium"
        >
          {credits} CREDITS
        </Chip>
      );
    }
  };

  // Function to render the active content based on selected tab
  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">Activity Overview</h2>
              <p className="text-gray-500">Track your coding progress</p>
            </div>
            
            
            <div className="bg-gray-50 p-8 rounded-lg text-center">
              <p className="text-gray-500">Start solving problems to see your activity here!</p>
              <Button 
                color="primary" 
                className="mt-4" 
                onPress={() => setActiveTab("bank")}
              >
                Browse Questions
              </Button>
            </div>
          </div>
        );
      case "bank":
        return (
          <div>
            {supabase ? (
              <QuestionBankSection supabase={supabase} />
            ) : (
              <div className="py-12 text-center text-gray-500">
                <p>Unable to load Question Bank. Please try refreshing the page.</p>
              </div>
            )}
          </div>
        );
      case "problems":
        return (
          <div className="text-center py-8">
            <div className="max-w-md mx-auto">
              <div className="rounded-full bg-primary-50 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Code size={24} className="text-primary-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Practice Problems</h3>
              <p className="text-gray-500 mb-6">
                Personalized practice problems will appear here as you complete more challenges.
              </p>
              <Button 
                color="primary" 
                onPress={() => setActiveTab("bank")}
              >
                Start with Question Bank
              </Button>
            </div>
          </div>
        );
      case "solutions":
        return (
          <div className="text-center py-8">
            <div className="max-w-md mx-auto">
              <div className="rounded-full bg-primary-50 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BookIcon size={24} className="text-primary-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">My Solutions</h3>
              <p className="text-gray-500 mb-6">
                Your solved problems and solutions will appear here.
              </p>
              <Button 
                color="primary" 
                onPress={() => setActiveTab("bank")}
              >
                Solve Your First Problem
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* Logo and Brand */}
            <div className="flex items-center gap-2">
              <div className="bg-primary-600 text-white h-10 w-10 rounded-lg flex items-center justify-center font-bold">CD</div>
              <h1 className="text-xl font-bold hidden sm:block">Coder Duo</h1>
            </div>

            {/* Center Navigation - Desktop */}
            <nav className="hidden md:flex items-center space-x-1">
              <Button
                variant={activeTab === "home" ? "flat" : "light"}
                className={`px-4 ${activeTab === "home" ? "bg-primary-50 text-primary-600" : ""}`}
                startContent={<Home size={18} />}
                onPress={() => setActiveTab("home")}
              >
                Home
              </Button>
              <Button
                variant={activeTab === "problems" ? "flat" : "light"}
                className={`px-4 ${activeTab === "problems" ? "bg-primary-50 text-primary-600" : ""}`}
                startContent={<Code size={18} />}
                onPress={() => setActiveTab("problems")}
              >
                Problems
              </Button>
              <Button
                variant={activeTab === "solutions" ? "flat" : "light"}
                className={`px-4 ${activeTab === "solutions" ? "bg-primary-50 text-primary-600" : ""}`}
                startContent={<BookIcon size={18} />}
                onPress={() => setActiveTab("solutions")}
              >
                My Solutions
              </Button>
              <Button
                variant={activeTab === "bank" ? "flat" : "light"}
                className={`px-4 ${activeTab === "bank" ? "bg-primary-50 text-primary-600" : ""}`}
                startContent={<List size={18} />}
                onPress={() => setActiveTab("bank")}
              >
                Question Bank
              </Button>
            </nav>

            {/* Right side - Plan info & user profile */}
            <div className="flex items-center gap-3">
              {/* Credit status - shown to immediate left of profile */}
              <div className="hidden sm:block">
                <Tooltip
                  content={
                    <div className="px-1 py-2">
                      <div className="text-small font-bold mb-1">
                        {isFreeUser ? "Free Plan " : `${credits} Credits Available`}
                      </div>
                      <div className="text-tiny">
                        {isFreeUser ? "Limited access - Buy credits to unlock full features" : "Click to purchase more credits"}
                      </div>
                    </div>
                  }
                  placement="bottom"
                >
                  <Button 
                    size="sm"
                    variant="flat" 
                    color={isFreeUser ? "default" : "primary"}
                    className="min-w-0 h-8"
                    startContent={<CreditCardIcon size={16} />}
                    endContent={<ChevronDown size={14} />}
                    onPress={() => {
                      // Clear any previously selected pack ID
                      setSelectedCreditPackId(null);
                      openCreditModal();
                    }}
                  >
                    {isFreeUser ? "Free Plan" : `${credits} Credits`}
                  </Button>
                </Tooltip>
              </div>

              {/* User profile dropdown */}
              <Dropdown placement="bottom-end" className="shadow-xl">
                <DropdownTrigger>
                  <div className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-full px-2 py-1 hover:bg-gray-50 transition-all duration-200">
                    <Avatar
                      name={displayName || "User"}
                      className="bg-primary-100 text-primary-600"
                      size="sm"
                    />
                    <div className="hidden sm:flex flex-col">
                      <span className="text-sm font-medium">{displayName || "User"}</span>
                    </div>
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                </DropdownTrigger>
                <DropdownMenu 
                  aria-label="User Actions"
                  className="p-3 w-[340px] rounded-lg"
                  itemClasses={{
                    base: "rounded-md gap-3"
                  }}
                >
                  <DropdownItem 
                    isReadOnly
                    key="header" 
                    className="opacity-100 cursor-default"
                    textValue="User Profile Header"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={displayName || "User"}
                        className="h-14 w-14 text-xl bg-primary-100 text-primary-600"
                      />
                      <div className="flex flex-col">
                        <p className="font-semibold text-lg">{displayName || "User"}</p>
                        <p className="text-sm text-gray-500">{userEmail || "Loading email..."}</p>
                        <div className="mt-1">{renderCreditBadge()}</div>
                      </div>
                    </div>
                  </DropdownItem>
                  <DropdownItem key="divider1" textValue="divider1">
                    <div className="h-px w-full bg-gray-200 my-2"></div>
                  </DropdownItem>
                  <DropdownItem 
                    key="profile" 
                    startContent={<User size={18} className="text-primary-600" />}
                    onPress={openProfileModal}
                    className="py-2"
                    textValue="Your Profile"
                  >
                    <div>
                      <p className="font-medium">Your Profile</p>
                      <p className="text-xs text-gray-500">Manage your account settings</p>
                    </div>
                  </DropdownItem>
                  <DropdownItem key="divider2" textValue="divider2">
                    <div className="h-px w-full bg-gray-200 my-2"></div>
                  </DropdownItem>
                  <DropdownItem 
                    key="credits_header"
                    isReadOnly
                    className="opacity-100 cursor-default py-1"
                    textValue="Credits"
                  >
                    <p className="text-xs uppercase font-bold text-gray-500 tracking-wider">Credits</p>
                  </DropdownItem>
                  
                  <DropdownItem 
                    key="credits_info" 
                    className="p-0"
                    isReadOnly
                    textValue="Credit Information"
                  >
                    <div className="w-full p-2">
                      <Card className="border border-gray-200 bg-gray-50">
                        <CardBody className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Available Credits</p>
                              <p className="text-xs text-gray-500">{isFreeUser ? "Free plan (limited access)" : "Pay-as-you-go"}</p>
                            </div>
                            <div className="text-2xl font-bold text-primary-600">{credits}</div>
                          </div>
                          <Button 
                            color="primary" 
                            size="sm" 
                            className="w-full"
                            endContent={<Plus size={16} />}
                            onPress={() => {
                              setSelectedCreditPackId(null);
                              openCreditModal();
                            }}
                          >
                            Buy More Credits
                          </Button>
                        </CardBody>
                      </Card>
                    </div>
                  </DropdownItem>
                  
                  <DropdownItem key="divider3" textValue="divider3">
                    <div className="h-px w-full bg-gray-200 my-2"></div>
                  </DropdownItem>
                  
                  <DropdownItem 
                    key="logout" 
                    startContent={<LogOut size={18} className="text-danger" />}
                    color="danger"
                    onPress={handleSignOut}
                    className="py-2"
                    textValue="Sign Out"
                  >
                    Sign Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>

              {/* Mobile menu toggle */}
              <Button
                isIconOnly
                variant="light"
                className="md:hidden"
                onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu size={24} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 py-2 px-4 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex flex-col gap-3">
            {/* Credits information on mobile */}
            <div className="p-4 mb-1 bg-gradient-to-br from-primary-50 to-white rounded-xl border border-primary-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary-100 p-1.5 rounded-full">
                    <CreditCardIcon size={16} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {isFreeUser ? "Free Plan" : "Credit Plan"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isFreeUser ? "3 credits available" : `${credits} credits available`}
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="flat"
                  color="primary"
                  className="h-8 min-w-0 font-medium shadow-sm"
                  onPress={() => {
                    setSelectedCreditPackId(null);
                    openCreditModal();
                  }}
                >
                  Buy Credits
                </Button>
              </div>
            </div>
            <Button
              variant={activeTab === "home" ? "flat" : "light"}
              className="justify-start"
              startContent={<Home size={18} />}
              onPress={() => {
                setActiveTab("home");
                setMobileMenuOpen(false);
              }}
            >
              Home
            </Button>
            <Button
              variant={activeTab === "problems" ? "flat" : "light"}
              className="justify-start"
              startContent={<Code size={18} />}
              onPress={() => {
                setActiveTab("problems");
                setMobileMenuOpen(false);
              }}
            >
              Problems
            </Button>
            <Button
              variant={activeTab === "solutions" ? "flat" : "light"}
              className="justify-start"
              startContent={<BookIcon size={18} />}
              onPress={() => {
                setActiveTab("solutions");
                setMobileMenuOpen(false);
              }}
            >
              My Solutions
            </Button>
            <Button
              variant={activeTab === "bank" ? "flat" : "light"}
              className="justify-start"
              startContent={<List size={18} />}
              onPress={() => {
                setActiveTab("bank");
                setMobileMenuOpen(false);
              }}
            >
              Question Bank
            </Button>
            <div className="h-px w-full bg-gray-200 my-3"></div>
            <Button
              variant="light"
              className="justify-start"
              startContent={<User size={18} />}
              onPress={() => {
                openProfileModal();
                setMobileMenuOpen(false);
              }}
            >
              Your Profile
            </Button>
            <Button
              color="danger"
              variant="flat"
              startContent={<LogOut size={18} />}
              className="justify-start"
              onPress={handleSignOut}
              isLoading={isLoading}
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName || "Coder"}!</h1>
          <p className="text-gray-500">Your personalized coding practice dashboard</p>
        </div>

        {/* Dynamic Content Based on Selected Tab */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 mb-6 p-6">
          {renderContent()}
        </div>
        
      </main>

      {/* Profile Edit Modal */}
      <Modal 
        isOpen={isProfileModalOpen} 
        onClose={closeProfileModal} 
        backdrop="blur" 
        size="md" 
        scrollBehavior="inside" 
        classNames={{backdrop: "bg-gradient-to-br from-primary-500/10 to-primary-900/20 backdrop-blur-md"}}
      >
        <ModalContent className="rounded-xl shadow-2xl">
          <ModalHeader className="flex flex-col gap-1 border-b pb-4 bg-gradient-to-r from-primary-50 to-white">
            <h2 className="text-xl font-bold">Edit Your Profile</h2>
            <p className="text-sm text-gray-500">Update your account information</p>
          </ModalHeader>
          <ModalBody className="py-6 px-6">
            <div className="flex flex-col gap-5">
              <div className="flex justify-center">
                <Avatar
                  name={displayName || "User"}
                  className="h-20 w-20 text-2xl bg-primary-100 text-primary-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <Input
                  value={displayName}
                  onValueChange={handleNameChange}
                  placeholder="Enter your name"
                  variant="bordered"
                  size="md"
                  startContent={<User size={16} className="text-gray-400" />}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <Input
                  value={userEmail || ""}
                  isReadOnly
                  variant="bordered"
                  size="md"
                  description="Email address cannot be changed"
                  startContent={<CreditCard size={16} className="text-gray-400" />}
                />
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Your Credits</h3>
                <Card className="bg-gray-50 border border-gray-200">
                  <CardBody className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{credits} Credits Available</p>
                        <p className="text-xs text-gray-500">{isFreeUser ? "Free plan" : "Pay-as-you-go"}</p>
                      </div>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onPress={() => {
                          closeProfileModal();
                          openCreditModal();
                        }}
                      >
                        Buy More
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="bordered" 
              onPress={closeProfileModal}
            >
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={saveProfile}
              className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-md font-medium"
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Credit Purchase Modal */}
      <CreditModal
        isOpen={isCreditModalOpen}
        onClose={closeCreditModal}
        userId={userId}
        currentCredits={credits}
        onCreditsUpdated={handleCreditUpdate}
        selectedPackId={selectedCreditPackId || undefined}
      />

      {/* Toast Container for notifications */}
      <ToastContainer />
    </div>
  );
}
