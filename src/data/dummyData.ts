export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isOnline: boolean;
  isTyping: boolean;
}

export interface Message {
  id: string;
  text: string;
  time: string;
  isSent: boolean;
  isRead: boolean;
  isDelivered: boolean;
}

export interface StatusItem {
  id: string;
  name: string;
  avatar: string;
  time: string;
  isSeen: boolean;
}

export interface CallItem {
  id: string;
  name: string;
  avatar: string;
  time: string;
  type: 'incoming' | 'outgoing' | 'missed';
  callType: 'voice' | 'video';
}

export const DUMMY_CHATS: Chat[] = [
  {
    id: '1',
    name: 'Sarah Wilson',
    avatar: 'https://i.pravatar.cc/150?img=1',
    lastMessage: 'Hey! How are you doing today? 😊',
    time: '12:45 PM',
    unreadCount: 3,
    isOnline: true,
    isTyping: false,
  },
  {
    id: '2',
    name: 'Dev Team 🚀',
    avatar: 'https://i.pravatar.cc/150?img=12',
    lastMessage: 'Alex: The new build is ready for testing',
    time: '11:30 AM',
    unreadCount: 12,
    isOnline: false,
    isTyping: true,
  },
  {
    id: '3',
    name: 'Mom ❤️',
    avatar: 'https://i.pravatar.cc/150?img=5',
    lastMessage: 'Don\'t forget to eat your lunch!',
    time: '10:15 AM',
    unreadCount: 1,
    isOnline: true,
    isTyping: false,
  },
  {
    id: '4',
    name: 'Jake Thompson',
    avatar: 'https://i.pravatar.cc/150?img=8',
    lastMessage: 'See you at the gym at 6 💪',
    time: 'Yesterday',
    unreadCount: 0,
    isOnline: false,
    isTyping: false,
  },
  {
    id: '5',
    name: 'Emily Chen',
    avatar: 'https://i.pravatar.cc/150?img=9',
    lastMessage: 'The presentation went great!',
    time: 'Yesterday',
    unreadCount: 0,
    isOnline: true,
    isTyping: false,
  },
  {
    id: '6',
    name: 'College Friends 🎓',
    avatar: 'https://i.pravatar.cc/150?img=15',
    lastMessage: 'Ryan: Weekend plans anyone?',
    time: 'Yesterday',
    unreadCount: 5,
    isOnline: false,
    isTyping: false,
  },
  {
    id: '7',
    name: 'David Miller',
    avatar: 'https://i.pravatar.cc/150?img=11',
    lastMessage: 'Thanks for the help! 🙏',
    time: 'Tuesday',
    unreadCount: 0,
    isOnline: false,
    isTyping: false,
  },
  {
    id: '8',
    name: 'Lisa Park',
    avatar: 'https://i.pravatar.cc/150?img=20',
    lastMessage: 'Photo attached 📸',
    time: 'Tuesday',
    unreadCount: 0,
    isOnline: true,
    isTyping: false,
  },
  {
    id: '9',
    name: 'Work Group 💼',
    avatar: 'https://i.pravatar.cc/150?img=22',
    lastMessage: 'Meeting at 3 PM confirmed',
    time: 'Monday',
    unreadCount: 0,
    isOnline: false,
    isTyping: false,
  },
  {
    id: '10',
    name: 'Michael Brown',
    avatar: 'https://i.pravatar.cc/150?img=14',
    lastMessage: 'Let me know when you\'re free',
    time: 'Monday',
    unreadCount: 2,
    isOnline: false,
    isTyping: false,
  },
];

export const DUMMY_MESSAGES: Message[] = [
  { id: '1', text: 'Hey! How are you? 👋', time: '12:30 PM', isSent: false, isRead: true, isDelivered: true },
  { id: '2', text: 'I\'m doing great! Just finished that project we talked about 🎉', time: '12:31 PM', isSent: true, isRead: true, isDelivered: true },
  { id: '3', text: 'That\'s awesome! Can you share some details?', time: '12:33 PM', isSent: false, isRead: true, isDelivered: true },
  { id: '4', text: 'Sure! It\'s a full-stack app with React Native frontend and Node.js backend', time: '12:35 PM', isSent: true, isRead: true, isDelivered: true },
  { id: '5', text: 'We used MongoDB for the database and Redis for caching', time: '12:35 PM', isSent: true, isRead: true, isDelivered: true },
  { id: '6', text: 'Sounds like a solid tech stack! How long did it take?', time: '12:38 PM', isSent: false, isRead: true, isDelivered: true },
  { id: '7', text: 'About 3 months from start to finish. The team worked really hard on it 💪', time: '12:40 PM', isSent: true, isRead: true, isDelivered: true },
  { id: '8', text: 'I\'d love to see a demo sometime!', time: '12:42 PM', isSent: false, isRead: true, isDelivered: true },
  { id: '9', text: 'Absolutely! Let\'s schedule a call this week 📞', time: '12:43 PM', isSent: true, isRead: false, isDelivered: true },
  { id: '10', text: 'Hey! How are you doing today? 😊', time: '12:45 PM', isSent: false, isRead: false, isDelivered: true },
];

export const DUMMY_STATUS: StatusItem[] = [
  { id: '1', name: 'Sarah Wilson', avatar: 'https://i.pravatar.cc/150?img=1', time: '25 minutes ago', isSeen: false },
  { id: '2', name: 'Emily Chen', avatar: 'https://i.pravatar.cc/150?img=9', time: '1 hour ago', isSeen: false },
  { id: '3', name: 'Jake Thompson', avatar: 'https://i.pravatar.cc/150?img=8', time: '3 hours ago', isSeen: true },
  { id: '4', name: 'Lisa Park', avatar: 'https://i.pravatar.cc/150?img=20', time: '5 hours ago', isSeen: true },
  { id: '5', name: 'David Miller', avatar: 'https://i.pravatar.cc/150?img=11', time: 'Today, 9:30 AM', isSeen: true },
];

export const DUMMY_CALLS: CallItem[] = [
  { id: '1', name: 'Sarah Wilson', avatar: 'https://i.pravatar.cc/150?img=1', time: 'Today, 12:30 PM', type: 'incoming', callType: 'video' },
  { id: '2', name: 'Mom ❤️', avatar: 'https://i.pravatar.cc/150?img=5', time: 'Today, 10:15 AM', type: 'outgoing', callType: 'voice' },
  { id: '3', name: 'Jake Thompson', avatar: 'https://i.pravatar.cc/150?img=8', time: 'Yesterday, 8:45 PM', type: 'missed', callType: 'voice' },
  { id: '4', name: 'Emily Chen', avatar: 'https://i.pravatar.cc/150?img=9', time: 'Yesterday, 3:20 PM', type: 'incoming', callType: 'video' },
  { id: '5', name: 'Dev Team 🚀', avatar: 'https://i.pravatar.cc/150?img=12', time: 'Monday, 2:00 PM', type: 'outgoing', callType: 'video' },
  { id: '6', name: 'David Miller', avatar: 'https://i.pravatar.cc/150?img=11', time: 'Monday, 11:00 AM', type: 'missed', callType: 'voice' },
];
