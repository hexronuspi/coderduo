"use client";

// --- React & Next.js Imports ---
import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// --- UI & Utility Libraries ---
import {
  Card,
  CardBody,
  Button,
  Avatar,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import {
  LogOut,
  Code,
  List,
  Home,
  CreditCard,
  User,
  Plus,
  History,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import { motion } from "framer-motion";

// --- Internal Component & Library Imports ---
import QuestionBank from "@/components/question-bank/question-bank";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CreditModal } from "@/components/credit/credit-modal";
import { useToast } from "@/components/ui/toast";
import UserHistoryView from "@/components/account/user-history";
import LoginStreak from "@/components/account/login-streak";
import QuestionUpload from "@/components/question-bank/question-upload";
import MyQuestions from "@/components/question-bank/my-questions";

// --- Types ---
type SupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;
type UserProfile = {
  id: string;
  name?: string;
  credits?: number;
  login_times?: string[];
  email?: string;
};

// --- Custom Hook for User Profile Logic (Unchanged) ---
const useUserProfile = (supabase: SupabaseClient) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(
    async (userId: string) => {
      setLoading(true);
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
          return;
        }

        if (data) {
          if (!data.login_times || data.login_times.length === 0) {
            const currentTime = new Date().toISOString();
            await supabase
              .from("users")
              .update({ login_times: [currentTime] })
              .eq("id", userId);
            data.login_times = [currentTime];
          }
          setProfile({ ...data, email: authUser?.email });
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const updateProfileName = async (name: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from("users")
      .update({ name })
      .eq("id", profile.id);
    if (error) throw error;
    setProfile((p) => (p ? { ...p, name } : null));
  };

  return { profile, loading, fetchUserProfile, updateProfileName, setProfile };
};


// --- Core UI Components (Sidebar, Headers, etc. - Unchanged) ---

const MobileHeader = ({ profile, onTabChange, onProfileClick, onHistoryClick, onSignOut, onBuyCredits }: { profile: UserProfile | null; onTabChange: (tab: string) => void; onProfileClick: () => void; onHistoryClick: () => void; onSignOut: () => void; onBuyCredits: () => void; }) => {
  const navItems = [{ key: "home", label: "Dashboard", icon: <Home size={20} /> }, { key: "bank", label: "Question Bank", icon: <List size={20} /> }, { key: "problems", label: "My Problems", icon: <Code size={20} /> }];
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-lg z-40 border-b border-slate-200 flex items-center justify-between px-4">
      <Dropdown backdrop="blur">
        <DropdownTrigger><Button isIconOnly variant="light"><Menu size={24} /></Button></DropdownTrigger>
        <DropdownMenu aria-label="Navigation" onAction={(key) => onTabChange(key as string)} itemClasses={{ base: "gap-3" }}>
          {navItems.map((item) => <DropdownItem key={item.key} startContent={item.icon} textValue={item.label}>{item.label}</DropdownItem>)}
        </DropdownMenu>
      </Dropdown>
      <h1 className="text-xl font-bold text-slate-800">CoderDuo</h1>
      <Dropdown placement="bottom-end" backdrop="blur">
        <DropdownTrigger><Avatar name={profile?.name || "U"} size="sm" className="bg-blue-100 text-blue-600 font-bold" /></DropdownTrigger>
        <DropdownMenu aria-label="User Actions" className="p-2 w-64" itemClasses={{ base: "rounded-md" }}>
          <DropdownItem isReadOnly key="credits_header" className="opacity-100 cursor-default" textValue={`Credits: ${profile?.credits ?? 0}`}>
            <div className="flex justify-between items-center"><p className="text-sm font-medium text-slate-600">Credits Available</p><Chip size="sm" variant="flat" color="success" startContent={<CreditCard size={14} />} classNames={{ content: "font-semibold" }}>{profile?.credits ?? 0}</Chip></div>
          </DropdownItem>
          <DropdownItem key="add_credits" onPress={onBuyCredits} startContent={<Plus size={16} className="text-blue-500" />} textValue="Add Credits" className="data-[hover=true]:bg-blue-50/80 group mt-1"><p className="font-semibold text-blue-600 group-data-[hover=true]:text-blue-700">Add More Credits</p></DropdownItem>
          <DropdownItem key="profile" startContent={<User size={16} className="text-slate-500" />} onPress={onProfileClick} textValue="Your Profile" className="mt-2"><p className="font-medium text-slate-700">Your Profile</p></DropdownItem>
          <DropdownItem key="history" startContent={<History size={16} className="text-slate-500" />} onPress={onHistoryClick} textValue="Account History"><p className="font-medium text-slate-700">Account History</p></DropdownItem>
          <DropdownItem key="logout" startContent={<LogOut size={16} />} color="danger" onPress={onSignOut} className="text-danger font-medium mt-2" textValue="Sign Out">Sign Out</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </header>
  );
};

const SidebarNavItem = ({ icon, label, isActive, isCollapsed, onPress }: { icon: ReactNode; label: string; isActive: boolean; isCollapsed: boolean; onPress: () => void; }) => (
  <Tooltip content={label} placement="right" isDisabled={!isCollapsed} delay={0} closeDelay={0}>
    <Button onPress={onPress} variant="light" className={clsx("w-full h-11 justify-start items-center transition-all duration-200 ease-in-out", { "px-3": !isCollapsed, "px-2 justify-center": isCollapsed }, isActive ? "bg-blue-500/10 text-blue-600 font-semibold" : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800")}>
      <div className={clsx("transition-colors", isActive ? "text-blue-500" : "text-slate-400")}>{icon}</div>
      {!isCollapsed && <span className="ml-3 text-sm font-medium">{label}</span>}
    </Button>
  </Tooltip>
);

const Sidebar = ({ activeTab, onTabChange, profile, onSignOut, onProfileClick, onHistoryClick, isCollapsed, setCollapsed }: { activeTab: string; onTabChange: (tab: string) => void; profile: UserProfile | null; onSignOut: () => void; onProfileClick: () => void; onHistoryClick: () => void; isCollapsed: boolean; setCollapsed: (isCollapsed: boolean) => void; }) => {
  const navItems = [{ key: "home", label: "Dashboard", icon: <Home size={20} /> }, { key: "bank", label: "Question Bank", icon: <List size={20} /> }, { key: "problems", label: "My Problems", icon: <Code size={20} /> }];
  const ProfileDropdownSection = (
    <Dropdown placement={isCollapsed ? "bottom-end" : "top-end"} backdrop="blur" className="shadow-2xl border border-slate-100">
      <DropdownTrigger>
        <Button variant="light" className={clsx("w-full h-auto justify-start items-center transition-colors hover:bg-slate-100/80 rounded-lg", isCollapsed ? "p-2 justify-center" : "p-2")}>
          <Avatar name={profile?.name || "U"} size={isCollapsed ? "sm" : "md"} className="bg-blue-100 text-blue-600 font-bold transition-all" />
          {!isCollapsed && <div className="flex flex-col items-start ml-3 text-left overflow-hidden"><p className="font-semibold text-sm text-slate-800 truncate">{profile?.name || "Coder Duo"}</p><p className="text-xs text-slate-500 truncate">{profile?.email}</p></div>}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="User Actions" className="p-2 w-64 rounded-xl" itemClasses={{ base: "rounded-md gap-3 data-[hover=true]:bg-slate-100/80" }}>
        <DropdownItem key="profile" startContent={<User size={16} className="text-slate-500" />} onPress={onProfileClick} textValue="Your Profile"><p className="font-medium text-slate-700">Your Profile</p></DropdownItem>
        <DropdownItem key="history" startContent={<History size={16} className="text-slate-500" />} onPress={onHistoryClick} textValue="Account History"><p className="font-medium text-slate-700">Account History</p></DropdownItem>
        <DropdownItem key="logout" startContent={<LogOut size={16} />} color="danger" onPress={onSignOut} className="text-danger font-medium" textValue="Sign Out">Sign Out</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
  return (
    <aside className={clsx("fixed h-full bg-white border-r border-slate-200 flex-col transition-all duration-300 ease-in-out z-50", "hidden lg:flex", isCollapsed ? "w-20 pb-4" : "w-64")}>
      <div className="h-16 flex items-center border-b border-slate-200 px-4"><div className={clsx("flex items-center w-full", { "justify-center": isCollapsed })}>{isCollapsed ? ProfileDropdownSection : <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap">CoderDuo</h1>}</div></div>
      <nav className="flex-grow space-y-2 pt-6 p-2">{navItems.map((item) => <SidebarNavItem key={item.key} icon={item.icon} label={item.label} isActive={activeTab === item.key} isCollapsed={isCollapsed} onPress={() => onTabChange(item.key)} />)}</nav>
      <div className={clsx("border-t border-slate-200 relative", isCollapsed ? "p-2" : "p-3")}>
        <Button isIconOnly variant="light" className="absolute -right-4 top-1/2 -translate-y-1/2 bg-white border-2 border-slate-200 rounded-full w-8 h-8 hover:bg-slate-100 z-10" onPress={() => setCollapsed(!isCollapsed)}>{isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</Button>
        {!isCollapsed && ProfileDropdownSection}
      </div>
    </aside>
  );
};

const Header = ({ profile, onBuyCredits }: { profile: UserProfile | null; onBuyCredits: () => void; }) => {
  const credits = profile?.credits ?? 0;
  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur-lg z-40 border-b border-slate-200 hidden lg:block">
      <div className="container max-w-full mx-auto px-8 h-16 flex justify-between items-center">
        <div><h1 className="text-xl font-semibold text-slate-800">Welcome back, {profile?.name || "Coder"}!</h1><p className="text-sm text-slate-500">Let&apos;s make today a productive day.</p></div>
        <Dropdown placement="bottom-end" backdrop="blur" className="shadow-xl border border-slate-100">
          <DropdownTrigger><Button variant="bordered" className="h-10 border-slate-200/80 data-[hover=true]:bg-slate-100"><CreditCard size={16} className="text-green-500" /><span className="font-semibold text-sm text-slate-700 ml-2">{credits}</span><span className="text-sm text-slate-500 ml-1.5">Credits</span></Button></DropdownTrigger>
          <DropdownMenu aria-label="Credits Actions" className="p-2 w-64" itemClasses={{ base: "rounded-md" }}>
            <DropdownItem isReadOnly key="header" className="opacity-100 cursor-default" textValue="Current Credits"><div className="flex justify-between items-center"><p className="text-sm font-medium text-slate-600">Credits Available</p><Chip size="sm" variant="flat" color="success" classNames={{ content: "font-semibold" }}>{credits}</Chip></div></DropdownItem>
            <DropdownItem key="add_credits" onPress={onBuyCredits} startContent={<Plus size={16} className="text-blue-500" />} textValue="Add Credits" className="data-[hover=true]:bg-blue-50/80 group mt-1"><p className="font-semibold text-blue-600 group-data-[hover=true]:text-blue-700">Add More Credits</p></DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </header>
  );
};

// --- View Components for Tabs ---
// Each component represents the content of a specific tab for better organization.

const features = [{ icon: Sparkles, text: "Curated coding questions for all levels" }, { icon: History, text: "Track your progress and login streaks" }, { icon: Code, text: "Create and manage your own problems" }];

const DashboardHomeView = ({ profile, onTabChange }: { profile: UserProfile | null; onTabChange: (tab: string) => void; }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="group lg:col-span-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/70">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full opacity-40 -z-10 bg-[radial-gradient(circle_at_top_left,theme(colors.blue.100),transparent_40%)]" />
        <div className="flex flex-col lg:flex-row">
          <div className="flex flex-col justify-center p-8 lg:p-10 lg:w-3/5">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Ready to Practice?</h3>
            <p className="mt-2 mb-6 max-w-md text-slate-600">Sharpen your skills with our extensive question bank designed to help you master key concepts and ace technical interviews.</p>
            <Button size="lg" className="w-fit h-12 px-6 font-bold text-white bg-blue-600 shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700" onPress={() => onTabChange("bank")} endContent={<ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />}>Explore Question Bank</Button>
          </div>
          <div className="lg:w-2/5 bg-white/60 backdrop-blur-sm p-8 lg:p-10 border-t border-slate-200/80 lg:border-t-0 lg:border-l lg:border-slate-200/80">
            <h4 className="font-semibold text-slate-700 mb-4">What&apos;s Inside:</h4>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <motion.li key={i} className="flex items-start gap-3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.2 + i * 0.1 }}>
                  <feature.icon className="w-5 h-5 mt-0.5 shrink-0 text-blue-500" aria-hidden="true" />
                  <span className="text-slate-600">{feature.text}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
      <div className="lg:col-span-3"><h2 className="text-xl font-semibold text-slate-900">Activity Overview</h2><p className="text-slate-500 mt-1">Track your daily progress and login streak.</p></div>
      <Card className="lg:col-span-3 p-2 shadow-sm border border-slate-200/80">
        <LoginStreak loginTimes={profile?.login_times || []} userId={profile?.id || ""} />
      </Card>
    </div>
);

/**
 * ## ProblemsWorkspace Component
 *
 * This is the dedicated, fully responsive component for the "My Problems" tab.
 * - It uses a flexbox column layout (`flex flex-col`) to ensure it fills the available vertical space.
 * - The `Tabs` component is configured to also grow (`flex-grow`), allowing its content panel to expand.
 * - This structure guarantees that the content (MyQuestions list or the Create form) uses the screen
 *   real estate effectively on all devices.
 */
const ProblemsWorkspace = ({ profile, supabase, fetchUserProfile, onBuyCredits }: { profile: UserProfile | null; supabase: SupabaseClient; fetchUserProfile: (userId: string) => Promise<void>; onBuyCredits: () => void; }) => {
    const router = useRouter();
    return (
        <motion.div
            key="problems-workspace"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col h-full w-full" // Key for responsiveness: Take up all available space
        >
            <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Your Problem Workspace</h2>
                <p className="mt-2 max-w-2xl text-sm md:text-base text-slate-500">The perfect place to create, manage, and refine coding challenges. Tailor your practice by building problems that matter to you.</p>
            </div>

            <Tabs
                aria-label="Problem workspace options"
                defaultSelectedKey="my-problems"
                variant="light"
                classNames={{
                    base: "w-full",
                    tabList: "w-full p-1.5 h-auto rounded-xl bg-slate-100 shadow-inner shadow-slate-200/80 flex-wrap md:flex-nowrap",
                    cursor: "bg-white rounded-lg shadow-lg shadow-blue-500/10",
                    tab: "h-11 text-sm md:text-base rounded-lg px-4 md:px-6 flex-grow md:flex-grow-0",
                    tabContent: "group-data-[selected=true]:text-blue-600 font-semibold text-slate-600 transition-colors duration-300 ease-in-out flex items-center gap-2",
                    panel: "mt-6 md:mt-8 p-0 bg-transparent w-full", // Panel takes full width
                }}
                className="flex-grow flex flex-col" // Key for responsiveness: Allows the Tabs component to expand
            >
                <Tab key="my-problems" title={<><List size={18} />My Problems</>} className="w-full">
                    <Card shadow="none" className="bg-transparent border-none w-full">
                        <CardBody className="p-0 overflow-hidden w-full">
                            {supabase && profile?.id ? (
                                <MyQuestions supabase={supabase} userId={profile.id} onProblemClick={(title: string, id: string) => router.push(`/dashboard/problems/${encodeURIComponent(title)}?id=${id}`)} />
                            ) : (
                                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 py-16 px-4 text-center w-full">
                                    <div className="mb-4 rounded-full bg-slate-200/60 p-4"><Code size={28} className="text-slate-500" /></div>
                                    <h3 className="text-lg font-semibold text-slate-800">Cannot Load Problems</h3>
                                    <p className="mt-1 max-w-sm text-slate-500">We couldn&apos;t fetch your custom problems. Please check your connection or try again.</p>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </Tab>

                <Tab key="create" title={<><Plus size={18} />Create New</>} className="w-full">
                    <Card shadow="md" className="bg-white border border-slate-200/80 shadow-slate-200/50 rounded-xl w-full">
                        <CardBody className="p-4 sm:p-6 lg:p-8 w-full">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6 w-full">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800">Submit a New Problem</h3>
                                    <p className="text-sm text-slate-500 mt-1">Fill out the details below. Creating a problem costs <strong className="text-blue-600">1 Credit</strong>.</p>
                                </div>
                                <Button color="primary" variant="flat" onPress={onBuyCredits} className="w-full md:w-auto flex-shrink-0 font-semibold" startContent={<CreditCard size={16} />}>Buy Credits</Button>
                            </div>
                            <QuestionUpload supabase={supabase} userId={profile?.id || ""} currentCredits={profile?.credits ?? 0} onQuestionCreated={() => profile?.id && fetchUserProfile(profile.id)} onBuyCredits={onBuyCredits} />
                        </CardBody>
                    </Card>
                </Tab>
            </Tabs>
        </motion.div>
    );
};


// --- Main Dashboard Component (Controller) ---
export default function Dashboard() {
    const router = useRouter();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { profile, fetchUserProfile, updateProfileName, setProfile } = useUserProfile(supabase);

    const [activeTab, setActiveTab] = useState("bank");
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [tempDisplayName, setTempDisplayName] = useState("");

    const { success, ToastContainer } = useToast();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") router.push("/auth");
            if (session?.user?.id && !profile) fetchUserProfile(session.user.id);
        });
        const getInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) { fetchUserProfile(session.user.id); } else { router.push("/auth"); }
        };
        getInitialSession();
        return () => subscription?.unsubscribe();
    }, [router, supabase, fetchUserProfile, profile]);

    useEffect(() => {
        if (profile?.name) { setTempDisplayName(profile.name); }
    }, [profile?.name, isProfileModalOpen]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };
    
    // Helper to prevent modal focus-trap errors when opened from a dropdown
    const deferModalOpen = (setter: (isOpen: boolean) => void) => setTimeout(() => setter(true), 50);

    const handleOpenProfile = () => deferModalOpen(setIsProfileModalOpen);
    const handleOpenHistory = () => deferModalOpen(setIsHistoryModalOpen);

    const handleBuyCredits = () => {
        const openCreditModal = () => deferModalOpen(setIsCreditModalOpen);
        type RazorpayWindow = Window & { Razorpay?: unknown; };
        const win = window as RazorpayWindow;
        if (!win.Razorpay) {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = openCreditModal;
            document.body.appendChild(script);
        } else {
            openCreditModal();
        }
    };

    const handleCreditUpdate = (newCredits: number) => {
        setProfile((p) => (p ? { ...p, credits: newCredits } : null));
        success("Credits Updated", `Your account now has ${newCredits} credits.`);
        setIsCreditModalOpen(false);
    };

    const handleSaveProfile = async () => {
        try {
            await updateProfileName(tempDisplayName);
            setIsProfileModalOpen(false);
            success("Profile Saved", "Your display name has been updated.");
        } catch (e) { console.error(e); }
    };

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case "home":
                return <DashboardHomeView profile={profile} onTabChange={setActiveTab} />;
            case "bank":
                return supabase ? <QuestionBank supabase={supabase} /> : null;
            case "problems":
                return <ProblemsWorkspace profile={profile} supabase={supabase} fetchUserProfile={fetchUserProfile} onBuyCredits={handleBuyCredits} />;
            default:
                return null;
        }
    };

    return (
        <div className="bg-slate-50 font-sans flex text-slate-800">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} profile={profile} onSignOut={handleSignOut} onProfileClick={handleOpenProfile} onHistoryClick={handleOpenHistory} isCollapsed={isSidebarCollapsed} setCollapsed={setSidebarCollapsed} />
            <MobileHeader profile={profile} onTabChange={setActiveTab} onProfileClick={handleOpenProfile} onHistoryClick={handleOpenHistory} onSignOut={handleSignOut} onBuyCredits={handleBuyCredits} />

            <div className={clsx("flex-1 flex flex-col transition-all duration-300 ease-in-out min-w-0", "pt-16 lg:pt-0", isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64")}>
                <Header profile={profile} onBuyCredits={handleBuyCredits} />
                <main className="flex-grow p-4 md:p-6 lg:p-8 flex">
                    {renderActiveTabContent()}
                </main>
            </div>

            {/* --- Modals --- */}
            <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} backdrop="blur" size="xl" classNames={{ base: "rounded-xl border border-slate-200", backdrop: "bg-black/20" }}>
                <ModalContent>{(onClose) => (<>
                    <ModalHeader className="flex flex-col gap-1 border-b border-slate-200 p-6 bg-slate-50/50"><h2 className="text-lg font-semibold text-slate-900">Profile Settings</h2></ModalHeader>
                    <ModalBody className="p-6">
                        <div className="flex flex-col gap-6">
                            <Input label="Display Name" labelPlacement="outside" value={tempDisplayName} onValueChange={setTempDisplayName} placeholder="Enter your name" variant="bordered" size="md" />
                            <Input label="Email Address" labelPlacement="outside" value={profile?.email || ""} isReadOnly variant="bordered" size="md" description="Email address cannot be changed." />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Current Plan</label>
                                <Card className="bg-slate-50 border border-slate-200 shadow-none"><CardBody className="p-4"><div className="flex justify-between items-center">
                                    <div><p className="font-medium text-slate-800">{profile?.credits} Credits Available</p></div>
                                    <Button size="sm" color="primary" variant="flat" onPress={() => { onClose(); handleBuyCredits(); }}>Add Credits</Button>
                                </div></CardBody></Card>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="bg-slate-50/50 border-t border-slate-200 p-4">
                        <Button variant="light" onPress={onClose}>Cancel</Button>
                        <Button color="primary" onPress={handleSaveProfile} className="bg-blue-600 font-semibold shadow-lg shadow-blue-500/20">Save Changes</Button>
                    </ModalFooter>
                </>)}</ModalContent>
            </Modal>

            <CreditModal isOpen={isCreditModalOpen} onClose={() => setIsCreditModalOpen(false)} userId={profile?.id || ""} currentCredits={profile?.credits || 0} onCreditsUpdated={handleCreditUpdate} />

            <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} backdrop="blur" size="4xl" scrollBehavior="inside" classNames={{ base: "rounded-xl max-h-[90vh] border border-slate-200", body: "p-0", backdrop: "bg-black/20" }}>
                <ModalContent>{(onClose) => (<>
                    <ModalHeader className="flex flex-col gap-1 border-b border-slate-200 p-6 bg-slate-50/50"><h2 className="text-lg font-semibold text-slate-900">Account History</h2></ModalHeader>
                    <ModalBody className="bg-white">{profile?.id && <UserHistoryView userId={profile.id} />}</ModalBody>
                    <ModalFooter className="bg-slate-50/50 border-t border-slate-200 p-4"><Button variant="light" onPress={onClose}>Close</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>

            <ToastContainer />
        </div>
    );
}