import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Clock, 
  CheckCircle,
  MessageSquare,
  Loader2
} from 'lucide-react';

interface SubmissionMessage {
  id: string;
  sender?: string;
  senderName?: string;
  fullName?: string;
  from?: string;
  sentBy?: string;
  submittedBy?: string;
  message?: string;
  content?: string;
  body?: string;
  createdAt?: string;
  created_at?: string;
}

interface InboxProps {
  authToken: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onNewMessageReceived?: (msg: SubmissionMessage) => void;
  currentUser?: { username: string; role: string; displayName?: string; fullName?: string; email?: string; avatarDataUrl?: string; barangay?: string } | null;
}

export const Inbox: React.FC<InboxProps> = ({ authToken, showToast, onNewMessageReceived, currentUser = null }) => {
  const [messages, setMessages] = useState<SubmissionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<SubmissionMessage | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Lists for user details mapping
  const [usersList, setUsersList] = useState<any[]>([]);

  const isMasterAdmin = React.useMemo(() => {
    if (!currentUser) return false;
    return currentUser.username.toLowerCase() === 'admin';
  }, [currentUser]);

  // Fetch users for mapping
  useEffect(() => {
    if (authToken) {
      fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) throw new Error('Received non-JSON');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setUsersList(data);
          }
        })
        .catch(err => {
          const errMsg = err?.message || '';
          if (
            err && (
              err.name === 'TypeError' ||
              err.name === 'AbortError' ||
              errMsg.includes('Failed to fetch') ||
              errMsg.includes('Network') ||
              errMsg.includes('load') ||
              errMsg.includes('JSON') ||
              errMsg.includes('HTTP')
            )
          ) {
            console.warn('Users fetch suspended in Inbox (server starting/restarting).');
          } else {
            console.error('Error fetching users:', err);
          }
        });
    }
  }, [authToken]);

  const fetchMessages = async (force = false) => {
    try {
      if (!force) setLoading(true);
      const res = await fetch(`/api/messages?force=${force}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch messages.');
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) throw new Error('Non-JSON response received.');
      const data = await res.json();
      
      if (Array.isArray(data)) {
        // Sort descending by date
        const sorted = data.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
          const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
          return dateB - dateA;
        });

        // Check if there are any new messages that weren't in our previous state
        if (messages.length > 0 && onNewMessageReceived) {
          const existingIds = new Set(messages.map(m => m.id));
          // Identify newly added messages
          const newMsgs = sorted.filter(m => !existingIds.has(m.id));
          if (newMsgs.length > 0) {
            newMsgs.forEach(msg => {
              onNewMessageReceived(msg);
            });
          }
        }

        setMessages(sorted);
        if (sorted.length > 0 && !selectedMessage) {
          setSelectedMessage(sorted[0]);
        }
      }
    } catch (err: any) {
      if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        console.warn('Messages fetch suspended (server starting/restarting).');
      } else {
        console.error('Error fetching messages:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Set up continuous polling every 15 seconds to trigger real-time notifications/automation popup
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [authToken]);

  // Robust resolver that checks all raw fields and maps username/displayNames to the official Full Name
  const getSender = (msg: any) => {
    const rawSender = msg.sender || msg.senderName || msg.fullName || msg.sentBy || msg.submittedBy || msg.from;
    
    if (!rawSender) return 'Anonymous';
    
    const cleanRaw = rawSender.trim();
    const matchedUser = usersList.find(u => 
      (u.username && u.username.toLowerCase() === cleanRaw.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase() === cleanRaw.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase() === cleanRaw.toLowerCase())
    );
    
    if (matchedUser) {
      return matchedUser.fullName || matchedUser.displayName || matchedUser.username;
    }
    
    return rawSender;
  };

  const getContent = (msg: any) => {
    return msg.message || msg.content || msg.body || 'No content';
  };

  const getDateStr = (msg: any) => {
    const d = msg.createdAt || msg.created_at;
    if (!d) return 'Just now';
    return new Date(d).toLocaleString();
  };

  const filteredMessages = messages.filter(msg => {
    const sender = getSender(msg).toLowerCase();
    const content = getContent(msg).toLowerCase();
    const query = searchQuery.toLowerCase();
    
    // Search query check
    const matchesSearch = sender.includes(query) || content.includes(query);
    if (!matchesSearch) return false;

    // Filter by account if user is not the master admin
    if (currentUser && !isMasterAdmin) {
      const usernameLower = currentUser.username.toLowerCase();
      const displayNameLower = (currentUser.displayName || '').toLowerCase().trim();
      const fullNameLower = (currentUser.fullName || '').toLowerCase().trim();
      const emailLower = (currentUser.email || '').toLowerCase().trim();
      const userBarangayLower = (currentUser.barangay || '').toLowerCase().trim();

      const senderLower = (msg.sender || msg.senderName || msg.fullName || msg.from || (msg as any).sentBy || '').toLowerCase().trim();
      const recipientLower = ((msg as any).recipient || (msg as any).to || '').toLowerCase().trim();
      const msgBarangayLower = ((msg as any).barangay || '').toLowerCase().trim();
      const submittedByLower = ((msg as any).submittedBy || (msg as any).submitted_by || '').toLowerCase().trim();
      const msgMemberName = ((msg as any).memberName || '').toLowerCase().trim();
      const msgSentByEmail = ((msg as any).sentByEmail || '').toLowerCase().trim();

      const isSender = 
        senderLower === usernameLower ||
        (displayNameLower && senderLower === displayNameLower) ||
        (fullNameLower && senderLower === fullNameLower) ||
        (emailLower && senderLower === emailLower) ||
        (emailLower && msgSentByEmail === emailLower);

      const isTarget = 
        recipientLower === usernameLower ||
        (displayNameLower && recipientLower === displayNameLower) ||
        (fullNameLower && recipientLower === fullNameLower) ||
        (emailLower && recipientLower === emailLower) ||
        submittedByLower === usernameLower ||
        (displayNameLower && submittedByLower === displayNameLower) ||
        (fullNameLower && submittedByLower === fullNameLower) ||
        (emailLower && submittedByLower === emailLower) ||
        msgMemberName === usernameLower ||
        (displayNameLower && msgMemberName === displayNameLower) ||
        (fullNameLower && msgMemberName === fullNameLower) ||
        (emailLower && msgMemberName === emailLower) ||
        (userBarangayLower && msgBarangayLower === userBarangayLower);

      return isSender || isTarget;
    }
    return true;
  });

  return (
    <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-4 sm:p-6 shadow-xs" id="inbox-page-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/60">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Mail className="w-5 h-5 text-teal-600" />
            Submission Inbox
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time messages synced directly with Base44 <span className="font-semibold text-slate-700">SubmissionMessage</span> table.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchMessages(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl transition-all border border-slate-200 shadow-3xs cursor-pointer focus:outline-none disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left pane: Message list with Search */}
        <div className={`lg:col-span-5 space-y-4 ${mobileView === 'list' ? 'block' : 'hidden lg:block'}`}>
          {/* Search bar & list */}
          <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden shadow-3xs flex flex-col h-[520px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sender or message content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-400"
                />
              </div>
              <div className="text-[11px] font-bold text-slate-400 px-2 shrink-0">
                {filteredMessages.length} total
              </div>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filteredMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 py-12">
                  <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">No messages found</p>
                  <p className="text-[10px] text-slate-400 mt-1">Inbox is currently empty.</p>
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  const sender = getSender(msg);
                  const content = getContent(msg);
                  const firstLetter = sender.charAt(0).toUpperCase() || '?';

                  return (
                    <div
                      key={msg.id}
                      onClick={() => {
                        setSelectedMessage(msg);
                        setMobileView('detail');
                      }}
                      className={`p-4 transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected 
                          ? 'bg-teal-50/40 border-l-4 border-teal-500' 
                          : 'hover:bg-slate-50/60 border-l-4 border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 font-extrabold text-xs shrink-0 select-none">
                        {firstLetter}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-black text-slate-800 truncate">
                            {sender}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                            {getDateStr(msg).split(',')[0]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium">
                          {content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right pane: Message details viewer */}
        <div className={`lg:col-span-7 ${mobileView === 'detail' ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white rounded-2xl border border-slate-200/50 p-4 sm:p-6 h-[520px] flex flex-col shadow-3xs relative overflow-hidden">
            {selectedMessage ? (
              <div className="flex-1 flex flex-col">
                {/* Mobile Back Button */}
                <div className="lg:hidden pb-4 border-b border-slate-100 mb-4 shrink-0">
                  <button
                    onClick={() => setMobileView('list')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    &larr; Back to Message List
                  </button>
                </div>

                <div className="pb-5 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 font-black text-sm select-none">
                      {getSender(selectedMessage).charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">
                        {getSender(selectedMessage)}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {getDateStr(selectedMessage)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 py-6 overflow-y-auto">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Message Body
                  </h4>
                  <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {getContent(selectedMessage)}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
                  <span className="text-[11px] text-slate-400 font-bold">
                    Read-only submission record
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Verified Submission Message
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-12">
                {/* Mobile Back Button if details is open with nothing selected */}
                <div className="lg:hidden mb-4 shrink-0">
                  <button
                    onClick={() => setMobileView('list')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    &larr; Back to Message List
                  </button>
                </div>
                <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  No Message Selected
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Choose a message from the list to view its contents.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
