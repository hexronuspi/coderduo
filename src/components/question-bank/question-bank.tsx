"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Input,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Pagination,
  Spinner,
  Tooltip,
  Checkbox,
  ScrollShadow,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@nextui-org/react";
import {
  Search,
  Tags,
  Award,
  SortAsc,
  SortDesc,
  Star,
  BookOpen,
  Filter,
  ListRestart,
  Clock,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TypedSupabaseClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

// --- Reusable Filter Modal Component with Search ---
interface FilterModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  allTags: string[];
  selectedDifficulties: string[];
  setSelectedDifficulties: (value: string[]) => void;
  selectedTags: string[];
  setSelectedTags: (value: string[]) => void;
  clearAllFilters: () => void;
}

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onOpenChange,
  allTags,
  selectedDifficulties,
  setSelectedDifficulties,
  selectedTags,
  setSelectedTags,
  clearAllFilters,
}) => {
  const [tagSearch, setTagSearch] = useState("");
  const difficultyOptions = [
    { name: "easy", color: "success" },
    { name: "medium", color: "warning" },
    { name: "hard", color: "danger" },
  ] as const;

  const toggleDifficulty = (difficulty: string) => {
    setSelectedDifficulties(
      selectedDifficulties.includes(difficulty)
        ? selectedDifficulties.filter((d) => d !== difficulty)
        : [...selectedDifficulties, difficulty]
    );
  };

  const toggleTag = (tag: string) => {
    const lowercasedTag = tag.toLowerCase();
    setSelectedTags(
      selectedTags.includes(lowercasedTag)
        ? selectedTags.filter((t) => t !== lowercasedTag)
        : [...selectedTags, lowercasedTag]
    );
  };

  const filteredTags = useMemo(() => {
    return allTags.filter((tag) =>
      tag.toLowerCase().includes(tagSearch.toLowerCase())
    );
  }, [allTags, tagSearch]);

  const handleClear = () => {
    clearAllFilters();
    setTagSearch("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      scrollBehavior="inside"
      placement="center"
      motionProps={{
        variants: { enter: { y: 0, opacity: 1 }, exit: { y: -20, opacity: 0 } },
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Filters</h2>
                <p className="text-sm font-normal text-slate-500">
                  Refine your search
                </p>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleClear}
                aria-label="Clear Filters"
              >
                <ListRestart size={18} />
              </Button>
            </ModalHeader>
            <ModalBody className="py-4">
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="font-semibold mb-3 text-slate-800 flex items-center gap-2">
                    <Award size={18} className="text-blue-500" /> Difficulty
                  </h3>
                  <div className="flex gap-2">
                    {difficultyOptions.map((d) => (
                      <Chip
                        key={d.name}
                        onClick={() => toggleDifficulty(d.name)}
                        color={d.color}
                        variant={
                          selectedDifficulties.includes(d.name)
                            ? "solid"
                            : "bordered"
                        }
                        className="capitalize cursor-pointer transition-all w-full h-10 text-sm font-medium"
                      >
                        {d.name}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Tags size={18} className="text-violet-500" /> Topics
                  </h3>
                  <Input
                    aria-label="Search topics"
                    placeholder="Search topics..."
                    startContent={<Search size={18} className="text-slate-400" />}
                    value={tagSearch}
                    onValueChange={setTagSearch}
                    isClearable
                    onClear={() => setTagSearch("")}
                  />
                  <ScrollShadow className="h-[250px] pr-2">
                    <div className="flex flex-col gap-2">
                      {filteredTags.length > 0 ? (
                        filteredTags.map((tag) => (
                          <Checkbox
                            key={tag}
                            color="success"
                            isSelected={selectedTags.includes(tag.toLowerCase())}
                            onValueChange={() => toggleTag(tag)}
                          >
                            <span className="capitalize">{tag}</span>
                          </Checkbox>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No topics found.
                        </p>
                      )}
                    </div>
                  </ScrollShadow>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onClose} className="font-semibold">
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

// --- Main Question Bank Component ---
interface QuestionBankProps {
  supabase: TypedSupabaseClient;
}

export interface Question {
  id: string;
  title: string;
  question: string;
  hint: string[];
  solution: string;
  difficulty: string;
  tags: string[];
}

export default function QuestionBank({ supabase }: QuestionBankProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const router = useRouter();
  const {
    isOpen: isFilterOpen,
    onOpen: onFilterOpen,
    onOpenChange: onFilterOpenChange,
  } = useDisclosure();
  const itemsPerPage = 15;

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    questions.forEach((q) => q.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [questions]);

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem("questionFavorites");
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
      const savedRecent = localStorage.getItem("recentlyViewedQuestions");
      if (savedRecent) setRecentlyViewed(JSON.parse(savedRecent));
    } catch (e) {
      console.error("Failed to parse data from localStorage", e);
    }
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("questions_global")
          .select("*")
          .order("title", { ascending: true });
        if (error) throw error;
        if (data) setQuestions(data as Question[]);
      } catch (err) {
        console.error("Error fetching questions:", err);
        setError("Failed to load questions. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, [supabase]);

  const filteredQuestions = useMemo(() => {
    let result = [...questions];

    if (selectedDifficulties.length > 0) {
      result = result.filter((q) =>
        selectedDifficulties.includes(q.difficulty?.toLowerCase())
      );
    }
    if (selectedTags.length > 0) {
      result = result.filter((q) =>
        q.tags?.some((tag) => selectedTags.includes(tag.toLowerCase()))
      );
    }
    if (searchQuery.trim()) {
      const lowercasedQuery = searchQuery.toLowerCase();
      result = result.filter(
        (q) =>
          q.title.toLowerCase().includes(lowercasedQuery) ||
          q.tags?.some((tag) => tag.toLowerCase().includes(lowercasedQuery))
      );
    }

    result.sort((a, b) => {
      const isAFav = favorites.includes(a.id);
      const isBFav = favorites.includes(b.id);
      if (isAFav !== isBFav) return isAFav ? -1 : 1;

      const difficultyOrder: { [key: string]: number } = {
        easy: 1,
        medium: 2,
        hard: 3,
      };
      const valA =
        sortBy === "difficulty"
          ? difficultyOrder[a.difficulty?.toLowerCase() ?? ""] || 0
          : a.title.toLowerCase();
      const valB =
        sortBy === "difficulty"
          ? difficultyOrder[b.difficulty?.toLowerCase() ?? ""] || 0
          : b.title.toLowerCase();

      if (sortDirection === "asc") {
        return valA < valB ? -1 : valA > valB ? 1 : 0;
      } else {
        return valB < valA ? -1 : valB > valA ? 1 : 0;
      }
    });

    return result;
  }, [
    searchQuery,
    questions,
    selectedDifficulties,
    selectedTags,
    sortBy,
    sortDirection,
    favorites,
  ]);

  useEffect(() => {
    setPage(1);
  }, [filteredQuestions.length]);

  const handleQuestionClick = (questionTitle: string) => {
    const question = questions.find((q) => q.title === questionTitle);
    if (!question) return;
    const newRecentlyViewed = [
      question.id,
      ...recentlyViewed.filter((id) => id !== question.id),
    ].slice(0, 10);
    setRecentlyViewed(newRecentlyViewed);
    localStorage.setItem(
      "recentlyViewedQuestions",
      JSON.stringify(newRecentlyViewed)
    );
    router.push(`/dashboard/question_bank/${encodeURIComponent(question.title)}`);
  };

  const toggleFavorite = useCallback((questionId: string) => {
    setFavorites((currentFavorites) => {
      const newFavorites = currentFavorites.includes(questionId)
        ? currentFavorites.filter((id) => id !== questionId)
        : [...currentFavorites, questionId];
      localStorage.setItem("questionFavorites", JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const clearAllFilters = () => {
    setSelectedDifficulties([]);
    setSelectedTags([]);
  };

  const getDifficultyColor = (
    difficulty: string
  ): "success" | "warning" | "danger" | "default" =>
    ({ easy: "success", medium: "warning", hard: "danger" }[
      difficulty?.toLowerCase()
    ] as "success" | "warning" | "danger" | undefined) ?? "default";

  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
  const displayedQuestions = useMemo(
    () => filteredQuestions.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filteredQuestions, page, itemsPerPage]
  );

  const FavoriteItemCard = React.memo(({ questionId }: { questionId: string }) => {
    const question = useMemo(
      () => questions.find((q) => q.id === questionId),
      [questionId]
    );
    if (!question) return null;
    return (
      <Card
        isPressable
        onPress={() => handleQuestionClick(question.title)}
        className="bg-white hover:bg-slate-100 transition-colors w-52 sm:w-60 shrink-0 border border-slate-200"
        shadow="none"
      >
        <CardBody className="p-3">
          <p className="text-sm font-medium text-slate-700 line-clamp-1">
            {question.title}
          </p>
          <Chip
            size="sm"
            color={getDifficultyColor(question.difficulty)}
            variant="flat"
            className="capitalize mt-2"
          >
            {question.difficulty}
          </Chip>
        </CardBody>
      </Card>
    );
  });
  FavoriteItemCard.displayName = "FavoriteItemCard";

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Spinner color="primary" size="lg" label="Preparing the Arena..." />
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center bg-white p-8 rounded-2xl border border-red-200 shadow-lg max-w-md"
        >
          <div className="text-6xl mb-4">⚡️</div>
          <h3 className="text-2xl font-bold text-red-600 mb-2">
            A Glitch in the Matrix
          </h3>
          <p className="text-slate-600">{error}</p>
          <Button
            color="danger"
            variant="shadow"
            className="mt-6 font-bold"
            onPress={() => window.location.reload()}
          >
            Retry Connection
          </Button>
        </motion.div>
      </div>
    );

  return (
    <>
      <FilterModal
        isOpen={isFilterOpen}
        onOpenChange={onFilterOpenChange}
        allTags={allTags}
        selectedDifficulties={selectedDifficulties}
        setSelectedDifficulties={setSelectedDifficulties}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        clearAllFilters={clearAllFilters}
      />
      <div className="min-h-screen w-full bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8 font-sans">
        <main className="max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
          <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-blue-600 to-violet-600 leading-tight">
              Question Bank
            </h1>
            <p className="text-slate-600 mt-2 text-base sm:text-lg">
              Explore {questions.length}+ challenges to sharpen your skills.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4"
          >
            <Input
              aria-label="Search"
              placeholder="Search by title or tag..."
              startContent={<Search size={20} className="text-slate-400" />}
              value={searchQuery}
              onValueChange={setSearchQuery}
              isClearable
              onClear={() => setSearchQuery("")}
              classNames={{
                inputWrapper: "bg-white h-12 text-base",
                input: "placeholder:text-slate-400",
              }}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  onPress={onFilterOpen}
                  variant="bordered"
                  className="h-10 text-slate-700"
                  endContent={<ChevronDown size={16} />}
                >
                  <Filter size={16} /> Filters
                </Button>
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      variant="bordered"
                      className="h-10 text-slate-700"
                      endContent={<ChevronDown size={16} />}
                    >
                      Sort
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Sort options"
                    selectionMode="single"
                    selectedKeys={[sortBy]}
                    onSelectionChange={(keys) =>
                      setSortBy(Array.from(keys)[0] as string)
                    }
                  >
                    <DropdownItem key="title" startContent={<BookOpen size={16} />}>
                      Title
                    </DropdownItem>
                    <DropdownItem
                      key="difficulty"
                      startContent={<Award size={16} />}
                    >
                      Difficulty
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
                <Button
                  isIconOnly
                  variant="bordered"
                  className="h-10 w-10"
                  onPress={() =>
                    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                >
                  {sortDirection === "asc" ? (
                    <SortAsc size={20} />
                  ) : (
                    <SortDesc size={20} />
                  )}
                </Button>
              </div>
              <div className="text-sm text-slate-500 text-left sm:text-right">
                Showing {filteredQuestions.length} questions
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-8"
          >

            {recentlyViewed.length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-500" /> Recently Viewed
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {recentlyViewed.slice(0, 5).map((id) => {
                    const q = questions.find((q) => q.id === id);
                    if (!q) return null;
                    return (
                      <Card
                        key={id}
                        isPressable
                        onPress={() => handleQuestionClick(q.title)}
                        className="bg-white hover:bg-slate-100 transition-colors w-full border border-slate-200"
                        shadow="none"
                      >
                        <CardBody className="p-3 flex flex-col justify-between">
                          <p className="text-sm font-medium text-slate-700 line-clamp-2 h-10">
                            {q.title}
                          </p>
                          <Chip
                            size="sm"
                            color={getDifficultyColor(q.difficulty)}
                            variant="flat"
                            className="capitalize mt-2 self-start"
                          >
                            {q.difficulty}
                          </Chip>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Table
              aria-label="Question Bank Table"
              removeWrapper
              bottomContent={
                totalPages > 1 ? (
                  <div className="flex w-full justify-center mt-8">
                    <Pagination
                      isCompact
                      showControls
                      total={totalPages}
                      page={page}
                      onChange={setPage}
                      color="primary"
                    />
                  </div>
                ) : null
              }
            >
              <TableHeader>
                <TableColumn key="index" width={70}>#</TableColumn>
                <TableColumn key="title">TITLE</TableColumn>
                <TableColumn key="difficulty" width={140}>DIFFICULTY</TableColumn>
                <TableColumn key="tags" className="hidden sm:table-cell">TAGS</TableColumn>
              </TableHeader>
              <TableBody
                items={displayedQuestions}
                emptyContent={
                  <div className="text-center py-20 bg-transparent flex flex-col items-center">
                    <div className="text-6xl mb-6">🔭</div>
                    <h3 className="text-2xl font-bold mb-2 text-slate-800">
                      No Questions Found
                    </h3>
                    <p className="text-slate-500 max-w-sm">
                      Try adjusting your filters or search query.
                    </p>
                    <Button
                      color="primary"
                      variant="flat"
                      className="mt-8 font-semibold"
                      onPress={clearAllFilters}
                    >
                      Clear All Filters
                    </Button>
                  </div>
                }
              >
                {(item) => (
                  <TableRow
                    key={item.id}
                    className={`group transition-colors ${
                      favorites.includes(item.id)
                        ? "bg-amber-50 hover:bg-amber-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <TableCell className="text-sm text-slate-500 font-medium">
                      {filteredQuestions.indexOf(item) + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Tooltip
                          content={
                            favorites.includes(item.id)
                              ? "Remove from Favorites"
                              : "Add to Favorites. Favorited questions always appear at the top."
                          }
                          placement="right"
                        >
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="text-slate-400 data-[selected=true]:text-amber-500 -ml-2 z-10 transition-colors"
                            data-selected={favorites.includes(item.id)}
                            onPress={() => toggleFavorite(item.id)}
                          >
                            <Star
                              size={18}
                              fill={
                                favorites.includes(item.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </Button>
                        </Tooltip>
                        <span
                          onClick={() => handleQuestionClick(item.title)}
                          className="font-medium text-slate-800 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {item.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getDifficultyColor(item.difficulty)}
                        variant="flat"
                        className="capitalize"
                      >
                        {item.difficulty}
                      </Chip>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.slice(0, 3).map((tag) => (
                          <Chip
                            key={tag}
                            size="sm"
                            variant="dot"
                            color="primary"
                            className="border-none capitalize"
                          >
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </motion.div>
        </main>
      </div>
    </>
  );
}