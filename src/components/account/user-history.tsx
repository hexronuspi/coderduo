"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Button,
  Chip,
  Pagination,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider
} from "@nextui-org/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Clock, CreditCard, Download, FileText, Filter, RefreshCw } from "lucide-react";
import { format, parseISO, subDays, isAfter, formatDistanceToNow } from "date-fns";

// Types for user plans history data
interface UserPlanHistoryItem {
  id: string;
  user_id: string;
  plan_change_to: string;
  credits_added: number;
  payment_id: string | null;
  timestamp: string;
}


// Filter options
type FilterPeriod = 'all' | '7days' | '30days' | '90days';

// Custom formatter for timestamps
const formatTimestamp = (timestamp: string): string => {
  try {
    const date = parseISO(timestamp);
    return format(date, 'MMM dd, yyyy • h:mm a');
  } catch (_error) {
    console.log(_error)
    return 'Invalid date';
  }
};

// Function to calculate relative time
const getRelativeTime = (timestamp: string): string => {
  try {
    const date = parseISO(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (_error) {
    console.log(_error)
    return 'Unknown time';
  }
};

// Main component
export default function UserHistoryView({ userId }: { userId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyItems, setHistoryItems] = useState<UserPlanHistoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<UserPlanHistoryItem[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [page, setPage] = useState<number>(1);
  const rowsPerPage = 10;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<UserPlanHistoryItem | null>(null);

  // Fetch user plans history data
  useEffect(() => {
    const fetchUserPlansHistory = async () => {
      if (!userId) return;
      
      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('user_plans')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false });
          
        if (error) {
          console.error("Error fetching user plans history:", error);
          return;
        }
        
        if (data) {
          setHistoryItems(data);
          applyFilter(data, filterPeriod);
        }
      } catch (err) {
        console.error("Failed to fetch user plans history:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserPlansHistory();
  }, [userId, supabase, filterPeriod]);

  // Apply time-based filters
  const applyFilter = (data: UserPlanHistoryItem[], period: FilterPeriod) => {
    if (period === 'all') {
      setFilteredItems(data);
      return;
    }
    
    const now = new Date();
    let cutoffDate: Date;
    
    switch (period) {
      case '7days':
        cutoffDate = subDays(now, 7);
        break;
      case '30days':
        cutoffDate = subDays(now, 30);
        break;
      case '90days':
        cutoffDate = subDays(now, 90);
        break;
      default:
        cutoffDate = new Date(0); // Beginning of time
    }
    
    const filtered = data.filter(item => {
      try {
        const itemDate = parseISO(item.timestamp);
        return isAfter(itemDate, cutoffDate);
      } catch {
        return true; // Include if date parsing fails
      }
    });
    
    setFilteredItems(filtered);
  };

  // Analytics function removed

  // Get paginated data
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredItems.slice(start, end);
  }, [filteredItems, page]);

  // Show detail modal
  const showDetailModal = (item: UserPlanHistoryItem) => {
    setSelectedItem(item);
    onOpen();
  };

  // Render plan badge
  const renderPlanBadge = (plan: string) => {
    let color: "default" | "primary" | "secondary" | "success" | "warning" | "danger" | undefined;
    switch (plan.toLowerCase()) {
      case 'free':
        color = 'default';
        break;
      case 'payg':
        color = 'primary';
        break;
      case 'premium':
        color = 'secondary';
        break;
      default:
        color = 'default';
    }
    
    return (
      <Chip size="sm" color={color} variant="flat">{plan.toUpperCase()}</Chip>
    );
  };

  // Export history data as CSV
  const exportToCSV = () => {
    if (!historyItems.length) return;
    
    const headers = ["Date", "Plan Change", "Credits Added", "Payment ID"];
    const csvData = historyItems.map(item => [
      formatTimestamp(item.timestamp),
      item.plan_change_to || '-',
      item.credits_added || '0',
      item.payment_id || '-'
    ]);
    
    // Add headers to the beginning
    csvData.unshift(headers);
    
    // Convert to CSV format
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `account-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render list view
  const renderListView = () => (
    <Table
      aria-label="User history table"
      bottomContent={
        filteredItems.length > rowsPerPage ? (
          <div className="flex justify-center w-full">
            <Pagination
              total={Math.ceil(filteredItems.length / rowsPerPage)}
              page={page}
              onChange={setPage}
            />
          </div>
        ) : null
      }
      classNames={{
        wrapper: "shadow-none"
      }}
    >
      <TableHeader>
        <TableColumn>DATE</TableColumn>
        <TableColumn>ACTION</TableColumn>
        <TableColumn>PLAN</TableColumn>
        <TableColumn>CREDITS</TableColumn>
        <TableColumn>PAYMENT ID</TableColumn>
      </TableHeader>
      <TableBody
        emptyContent={
          loading ? (
            <Spinner label="Loading history..." color="primary" />
          ) : (
            "No account activity found"
          )
        }
        items={paginatedItems}
      >
        {(item) => (
          <TableRow key={item.id} className="cursor-pointer hover:bg-gray-50" onClick={() => showDetailModal(item)}>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{format(parseISO(item.timestamp), 'MMM dd, yyyy')}</span>
                <span className="text-xs text-gray-500">{format(parseISO(item.timestamp), 'h:mm a')}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {item.credits_added ? 'Credit Purchase' : 'Plan Change'}
                </span>
                <span className="text-xs text-gray-500">{getRelativeTime(item.timestamp)}</span>
              </div>
            </TableCell>
            <TableCell>{item.plan_change_to ? renderPlanBadge(item.plan_change_to) : '-'}</TableCell>
            <TableCell>
              {item.credits_added ? (
                <span className="font-medium text-primary-600">+{item.credits_added}</span>
              ) : '-'}
            </TableCell>
            <TableCell>
              <div className="max-w-[120px] truncate">
                {item.payment_id ? (
                  <span className="text-xs font-mono">{item.payment_id}</span>
                ) : '-'}
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="w-full space-y-4 px-4 py-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="hidden">
          <h2 className="text-xl font-bold">Account History</h2>
          <p className="text-sm text-gray-500">Track your plan changes and credit purchases</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Filter dropdown */}
          <Dropdown>
            <DropdownTrigger>
              <Button
                variant="flat"
                size="sm"
                startContent={<Filter size={16} />}
              >
                {filterPeriod === 'all' ? 'All Time' : 
                 filterPeriod === '7days' ? 'Last 7 Days' : 
                 filterPeriod === '30days' ? 'Last 30 Days' : 'Last 90 Days'}
              </Button>
            </DropdownTrigger>
            <DropdownMenu 
              aria-label="Filter time periods"
              onAction={(key) => setFilterPeriod(key as FilterPeriod)}
              selectedKeys={new Set([filterPeriod])}
              selectionMode="single"
            >
              <DropdownItem key="all">All Time</DropdownItem>
              <DropdownItem key="7days">Last 7 Days</DropdownItem>
              <DropdownItem key="30days">Last 30 Days</DropdownItem>
              <DropdownItem key="90days">Last 90 Days</DropdownItem>
            </DropdownMenu>
          </Dropdown>
          
          {/* Export button */}
          <Button
            variant="flat"
            size="sm"
            startContent={<Download size={16} />}
            onPress={exportToCSV}
            isDisabled={historyItems.length === 0 || loading}
          >
            Export
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="bg-white rounded p-2 sm:p-4">
        {renderListView()}
      </div>
      
      {/* Detail Modal */}
      {selectedItem && (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-xl">Activity Details</h3>
              <p className="text-sm text-gray-500">
                {selectedItem.credits_added ? 'Credit Purchase' : 'Plan Change'} • {getRelativeTime(selectedItem.timestamp)}
              </p>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Date & Time</p>
                    <div className="flex items-center mt-1">
                      <Clock size={16} className="text-gray-400 mr-2" />
                      <p>{formatTimestamp(selectedItem.timestamp)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500">Activity Type</p>
                    <div className="flex items-center mt-1">
                      {selectedItem.credits_added ? (
                        <>
                          <CreditCard size={16} className="text-primary-500 mr-2" />
                          <p>Credit Purchase</p>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} className="text-secondary-500 mr-2" />
                          <p>Plan Change</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <Divider className="my-2" />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedItem.plan_change_to && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Plan Changed To</p>
                      <div className="mt-1">
                        {renderPlanBadge(selectedItem.plan_change_to)}
                      </div>
                    </div>
                  )}
                  
                  {selectedItem.credits_added > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Credits Added</p>
                      <p className="text-lg font-semibold text-primary-600 mt-1">+{selectedItem.credits_added}</p>
                    </div>
                  )}
                </div>
                
                {selectedItem.payment_id && (
                  <>
                    <Divider className="my-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Payment Information</p>
                      <div className="flex items-center gap-2 mt-1 bg-gray-50 p-2 rounded border border-gray-200">
                        <FileText size={16} className="text-gray-500" />
                        <p className="font-mono text-xs break-all">{selectedItem.payment_id}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button onPress={onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
}
