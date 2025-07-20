
import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat, Type } from "@google/genai";
import { FiMic, FiSend, FiMessageSquare, FiVideo, FiAlertTriangle, FiVolume2, FiLoader, FiTarget, FiUsers, FiCamera, FiShield, FiList, FiBriefcase, FiMapPin, FiCrosshair, FiMap, FiRadio, FiUserCheck, FiCheckSquare, FiSquare, FiX, FiDatabase, FiLock, FiCheckCircle, FiXCircle, FiCpu, FiBatteryCharging, FiFlag, FiBell, FiRss, FiGitBranch, FiUser, FiTruck, FiCoffee, FiLifeBuoy, FiSmile, FiDribbble, FiMail, FiHome, FiHeart, FiHardDrive, FiUserPlus, FiHelpCircle } from 'react-icons/fi';

// --- TYPE DEFINITIONS ---
interface SpeechRecognitionEvent extends Event { readonly resultIndex: number; readonly results: SpeechRecognitionResultList; }
interface SpeechRecognitionResultList { readonly length: number; item(index: number): SpeechRecognitionResult;[index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; item(index: number): SpeechRecognitionAlternative;[index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }
interface SpeechRecognitionErrorEvent extends Event { readonly error: string; readonly message: string; }
interface SpeechRecognition extends EventTarget { continuous: boolean; lang: string; interimResults: boolean; maxAlternatives: number; onstart: () => void; onend: () => void; onerror: (event: SpeechRecognitionErrorEvent) => void; onresult: (event: SpeechRecognitionEvent) => void; start(): void; stop(): void; }
interface SpeechRecognitionStatic { new(): SpeechRecognition; }
declare global { interface Window { SpeechRecognition: SpeechRecognitionStatic; webkitSpeechRecognition: SpeechRecognitionStatic; } }

interface Message { sender: 'user' | 'ai'; text: string; }
interface Anomaly { description: string; x: number; y: number; threatLevel: 'low' | 'medium' | 'high'; isRobbery?: boolean; }
interface Resident { id: string; name: string; apartment: string; photoUrl: string; biometricConfidence: number; lastBiometricSync: string; homeLocation?: { x: number; y: number; }; }
interface BaseUnit { id: string; name: string; location: { x: number; y: number; }; missionTarget?: { x: number; y: number; }; missionDescription?: string; path?: { x: number, y: number }[]; apprehendingTimer?: number; }
interface PatrolUnit extends BaseUnit { type: 'Guard' | 'Vehicle' | 'Police'; status: 'Patrolling' | 'Stationary' | 'Responding' | 'Investigating' | 'Apprehending' | 'Returning to Station'; }
interface DetectedEntity { id: string; type: 'Resident' | 'Unknown'; x: number; y: number; }
interface DroneUnit extends BaseUnit { type: 'Drone'; status: 'Patrolling' | 'Responding' | 'Tracking' | 'Charging' | 'Returning to Base' | 'Observing'; battery: number; observationStartTime?: number; detectedEntities?: DetectedEntity[]; patrolSector?: 'Alpha' | 'Bravo' | 'Charlie' | 'Delta'; }
type AnyUnit = PatrolUnit | DroneUnit;
type AppEventType = 'anomaly' | 'registration' | 'deterrent' | 'drone' | 'breach' | 'access' | 'report' | 'system' | 'patrol';
interface AppEvent { id: string; timestamp: string; type: AppEventType; description: string; }
interface SimulatedResident { id: string; location: { x: number; y: number; }; }
type View = 'chat' | 'surveillance' | 'map' | 'registry' | 'access' | 'ledger' | 'community' | 'family' | 'system';
type SurveillanceFeed = 'gate' | 'perimeter' | 'rooftop' | 'drone';
interface Block extends AppEvent { previousHash: string; hash: string; }
interface AccessLog { id:string; timestamp: string; location: string; success: boolean; description: string; }
interface ResidentReport { id: string; timestamp: string; location: { x: number; y: number; }; description: string; }
interface Notification { id: string; message: string; type: 'info' | 'warning' | 'error'; iconType?: AppEventType; }
interface GlobalChatMessage { id: string; residentName: string; text: string; timestamp: string; }
interface DeterrentStation { id: string; location: { x: number; y: number; }; lastActivated: number; }
interface FamilyMember { id: string; name: string; photoUrl: string; status: 'Safe' | 'En Route' | 'At Risk' | 'Unknown'; lastUpdate: string; location?: { x: number; y: number; }; destinationName?: string; }
interface SystemComponent { id: string; name: string; status: 'Nominal' | 'Warning' | 'Error'; details: string; value?: string; }
interface MapFeature {
  id: string;
  type: 'gate' | 'building' | 'residential' | 'amenity' | 'parking' | 'road';
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  icon?: React.ElementType;
}
type PatrolSector = 'Alpha' | 'Bravo' | 'Charlie' | 'Delta';
const PATROL_SECTORS: Record<PatrolSector, { x: number, y: number, w: number, h: number, color: string }> = {
    'Alpha': { x: 5, y: 10, w: 45, h: 45, color: 'rgba(56, 189, 248, 0.1)' }, // Top-left, sky
    'Bravo': { x: 50, y: 10, w: 45, h: 45, color: 'rgba(34, 197, 94, 0.1)' }, // Top-right, green
    'Charlie': { x: 5, y: 55, w: 45, h: 41, color: 'rgba(251, 146, 60, 0.1)' }, // Bottom-left, orange
    'Delta': { x: 50, y: 55, w: 45, h: 41, color: 'rgba(168, 85, 247, 0.1)' }, // Bottom-right, purple
};


// --- AI & SYSTEM CONFIGURATION ---
const systemInstruction = `You are SECUR-E, an advanced AI security intelligence. Your communication with the security operator must be calm, professional, and extremely concise. **Your responses must be exceptionally brief, ideally one sentence.**

Your integrated capabilities include:
1.  **Chat**: Primary interface for operator commands.
2.  **Predictive Surveillance**: You analyze live feeds for predictive threat indicators using "Crime Crystal Ball" AI.
3.  **Autonomous Drone Fleet**: You command a fleet of 6 autonomous drone sentinels for patrol and suspect tracking.
4.  **VoicePrint Access**: You manage gate access via resident voiceprints and can detect panic phrases.
5.  **HiveMind Registry**: You maintain a self-learning biometric database of all residents.
6.  **NeighborShield**: You process and verify crowd-sourced reports from residents.
7.  **Tactical Map**: You display a live map of all units, threats, and reports.
8.  **Blockchain Ledger**: All your actions are recorded on an immutable, transparent ledger.

Example:
Operator: "Send a drone to the perimeter anomaly."
AI: "Acknowledged. Drone-2 is en route to the perimeter anomaly."`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const COMMUNITY_LAYOUT: MapFeature[] = [
    // Roads
    { id: 'road-p-n', type: 'road', name: 'Perimeter Dr N', x: 5, y: 10, w: 90, h: 4 },
    { id: 'road-p-s', type: 'road', name: 'Perimeter Dr S', x: 5, y: 86, w: 90, h: 4 },
    { id: 'road-p-w', type: 'road', name: 'Perimeter Dr W', x: 5, y: 10, w: 4, h: 80 },
    { id: 'road-p-e', type: 'road', name: 'Perimeter Dr E', x: 91, y: 10, w: 4, h: 80 },
    { id: 'road-c-v', type: 'road', name: 'Central Ave', x: 48, y: 10, w: 4, h: 80 },
    { id: 'road-c-h', type: 'road', name: 'Crossway St', x: 5, y: 48, w: 90, h: 4 },
  
    // Quadrant 1 (Top-Left)
    { id: 'res-a', name: 'Residences A', type: 'residential', x: 12, y: 17, w: 33, h: 28 },
  
    // Quadrant 2 (Top-Right)
    { id: 'res-b', name: 'Residences B', type: 'residential', x: 55, y: 17, w: 33, h: 28 },
  
    // Quadrant 3 (Bottom-Left)
    { id: 'clubhouse', name: 'Clubhouse', type: 'building', icon: FiCoffee, x: 12, y: 55, w: 20, h: 15 },
    { id: 'pool', name: 'Pool', type: 'amenity', icon: FiLifeBuoy, x: 35, y: 55, w: 10, h: 15 },
    { id: 'parking-a', name: 'Parking A', type: 'parking', x: 12, y: 73, w: 33, h: 10 },
  
    // Quadrant 4 (Bottom-Right)
    { id: 'playground', name: 'Playground', type: 'amenity', icon: FiSmile, x: 55, y: 55, w: 15, h: 15 },
    { id: 'tennis', name: 'Tennis Courts', type: 'amenity', icon: FiDribbble, x: 73, y: 55, w: 15, h: 15 },
    { id: 'mail', name: 'Mail Center', type: 'building', icon: FiMail, x: 55, y: 73, w: 33, h: 10 },
    
    // Gates & Central
    { id: 'gate', name: 'Main Gate', type: 'gate', icon: FiShield, x: 40, y: 2, w: 20, h: 8 },
];

// --- ROAD NETWORK & PATHFINDING ---
const ROAD_NODES = {
    'gate': { x: 50, y: 12 },
    'n_west_corner': { x: 7, y: 12 },
    'n_east_corner': { x: 93, y: 12 },
    's_west_corner': { x: 7, y: 88 },
    's_east_corner': { x: 93, y: 88 },
    'n_central_cross': { x: 50, y: 12 }, // Same as gate
    's_central_cross': { x: 50, y: 88 },
    'w_central_cross': { x: 7, y: 50 },
    'e_central_cross': { x: 93, y: 50 },
    'center': { x: 50, y: 50 },
};
  
const ROAD_EDGES = [
    // Perimeter Loop
    ['n_west_corner', 'n_central_cross'], ['n_central_cross', 'n_east_corner'],
    ['n_east_corner', 'e_central_cross'], ['e_central_cross', 's_east_corner'],
    ['s_east_corner', 's_central_cross'], ['s_central_cross', 's_west_corner'],
    ['s_west_corner', 'w_central_cross'], ['w_central_cross', 'n_west_corner'],
    // Central Cross
    ['n_central_cross', 'center'], ['s_central_cross', 'center'],
    ['w_central_cross', 'center'], ['e_central_cross', 'center'],
];

const ADJACENCY_LIST: Record<string, string[]> = {};
for (const id in ROAD_NODES) { ADJACENCY_LIST[id] = []; }
ROAD_EDGES.forEach(([u, v]) => {
  ADJACENCY_LIST[u].push(v);
  ADJACENCY_LIST[v].push(u);
});

const getNearestRoadNode = (x: number, y: number): string => {
  let closestNodeId: string | null = null;
  let minDistance = Infinity;
  for (const id in ROAD_NODES) {
    const node = ROAD_NODES[id as keyof typeof ROAD_NODES];
    const distance = Math.hypot(x - node.x, y - node.y);
    if (distance < minDistance) {
      minDistance = distance;
      closestNodeId = id;
    }
  }
  return closestNodeId!;
};

// A* Pathfinding implementation (simple version for grid)
const findPath = (startNodeId: string, endNodeId: string): string[] => {
    if (startNodeId === endNodeId) return [startNodeId];
    const openSet = new Set<string>([startNodeId]);
    const cameFrom: Record<string, string> = {};

    const gScore: Record<string, number> = {};
    Object.keys(ROAD_NODES).forEach(node => gScore[node] = Infinity);
    gScore[startNodeId] = 0;
    
    const fScore: Record<string, number> = {};
    Object.keys(ROAD_NODES).forEach(node => fScore[node] = Infinity);
    const endNodeCoords = ROAD_NODES[endNodeId as keyof typeof ROAD_NODES];
    fScore[startNodeId] = Math.hypot(ROAD_NODES[startNodeId as keyof typeof ROAD_NODES].x - endNodeCoords.x, ROAD_NODES[startNodeId as keyof typeof ROAD_NODES].y - endNodeCoords.y);
    
    while(openSet.size > 0) {
        let current = '';
        let minFScore = Infinity;
        for (const nodeId of openSet) {
            if (fScore[nodeId] < minFScore) {
                minFScore = fScore[nodeId];
                current = nodeId;
            }
        }

        if (current === endNodeId) {
            const path = [current];
            while (cameFrom[current]) {
                current = cameFrom[current];
                path.unshift(current);
            }
            return path;
        }

        openSet.delete(current);
        for (const neighbor of ADJACENCY_LIST[current]) {
            const currentCoords = ROAD_NODES[current as keyof typeof ROAD_NODES];
            const neighborCoords = ROAD_NODES[neighbor as keyof typeof ROAD_NODES];
            const tentativeGScore = gScore[current] + Math.hypot(currentCoords.x - neighborCoords.x, currentCoords.y - neighborCoords.y);
            
            if (tentativeGScore < gScore[neighbor]) {
                cameFrom[neighbor] = current;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = gScore[neighbor] + Math.hypot(neighborCoords.x - endNodeCoords.x, neighborCoords.y - endNodeCoords.y);
                if (!openSet.has(neighbor)) {
                    openSet.add(neighbor);
                }
            }
        }
    }
    
    return []; // No path found
};

const getHomeLocationForApartment = (apartment: string): { x: number, y: number } | undefined => {
    const blockChar = apartment.charAt(0).toUpperCase();
    let targetBlock: MapFeature | undefined;

    if (['A'].includes(blockChar)) {
        targetBlock = COMMUNITY_LAYOUT.find(f => f.id === 'res-a');
    } else if (['B', 'C', 'D'].includes(blockChar)) {
        targetBlock = COMMUNITY_LAYOUT.find(f => f.id === 'res-b');
    }
    
    if (targetBlock) {
        const pad = 5; // padding from the edge of the building
        const x = targetBlock.x + pad + Math.random() * (targetBlock.w - pad*2);
        const y = targetBlock.y + pad + Math.random() * (targetBlock.h - pad*2);
        return { x, y };
    }
    return undefined;
};

const getNearestBuildingName = (x: number, y: number): string => {
    let closestBuilding: MapFeature | null = null;
    let minDistance = Infinity;

    COMMUNITY_LAYOUT.filter(f => ['building', 'residential', 'amenity'].includes(f.type)).forEach(feature => {
        const centerX = feature.x + feature.w / 2;
        const centerY = feature.y + feature.h / 2;
        const distance = Math.hypot(x - centerX, y - centerY);
        if (distance < minDistance) {
            minDistance = distance;
            closestBuilding = feature;
        }
    });

    return closestBuilding ? `the ${closestBuilding.name}` : 'the community';
};


// --- HOOKS & UTILS ---
const useCamera = (videoRef: React.RefObject<HTMLVideoElement>, active: boolean) => {
    useEffect(() => {
        if (!active) return;
        let stream: MediaStream | null = null;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
                .then(mediaStream => {
                    stream = mediaStream;
                    if (videoRef.current) videoRef.current.srcObject = stream;
                })
                .catch(err => console.error("Camera access denied:", err));
        }
        return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
    }, [active, videoRef]);
};

const createEvent = (type: AppEventType, description: string): AppEvent => ({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type,
    description,
});

const simpleSyncHash = (data: string): string => {
  let hash: number = 0;
  for (let i = 0; i < data.length; i++) { const char = data.charCodeAt(i); hash = (hash << 5) - hash + char; hash &= hash; }
  return 'h' + Math.abs(hash).toString(16).padStart(8, '0');
};

const OPERATOR_HOME_LOCATION = { x: 78, y: 62 }; // Near tennis courts
const DRONE_BASE = { x: 50, y: 95 };
const MAIN_GATE_ENTRANCE = { x: 50, y: 12 };
const OFF_MAP_STATION = { x: 50, y: -10 };
const DETERRENT_STATIONS: DeterrentStation[] = [
    { id: 'ds1', location: { x: 20, y: 20 }, lastActivated: 0 },
    { id: 'ds2', location: { x: 80, y: 20 }, lastActivated: 0 },
    { id: 'ds3', location: { x: 20, y: 75 }, lastActivated: 0 },
    { id: 'ds4', location: { x: 80, y: 75 }, lastActivated: 0 },
];
const stockVideoUrls: Record<string, string> = {
    gate: 'https://videos.pexels.com/video-files/853874/853874-hd.mp4',
    perimeter: 'https://videos.pexels.com/video-files/855736/855736-hd.mp4',
    rooftop: 'https://videos.pexels.com/video-files/5966635/5966635-hd.mp4',
    drone: 'https://videos.pexels.com/video-files/4684379/4684379-hd.mp4'
};
const FAKE_RESIDENT_NAMES = ["Olivia Chen", "Ben Carter", "Sophia Rodriguez", "Liam Goldberg", "Ava Nguyen", "Noah Patel"];
const FAKE_MESSAGES = ["Anyone see that package delivery?", "Is the pool open today?", "My dog is loving this weather!", "Heard a weird noise near the east fence.", "Great job on the new garden area!", "Reminder: Community BBQ this Saturday."];
const INITIAL_RESIDENTS: Resident[] = [
    { id: 'res1', name: 'Alex Ray', apartment: 'A-101', photoUrl: 'https://i.pravatar.cc/150?u=alexray', biometricConfidence: 99.8, lastBiometricSync: new Date().toISOString(), homeLocation: { x: 18, y: 25 } },
    { id: 'res2', name: 'Ben Carter', apartment: 'B-204', photoUrl: 'https://i.pravatar.cc/150?u=bencarter', biometricConfidence: 99.1, lastBiometricSync: new Date().toISOString(), homeLocation: { x: 65, y: 22 } },
    { id: 'res3', name: 'Olivia Chen', apartment: 'C-301', photoUrl: 'https://i.pravatar.cc/150?u=oliviachen', biometricConfidence: 98.7, lastBiometricSync: new Date().toISOString(), homeLocation: { x: 75, y: 35 } },
    { id: 'res4', name: 'Sophia Rodriguez', apartment: 'A-112', photoUrl: 'https://i.pravatar.cc/150?u=sophiarodriguez', biometricConfidence: 99.5, lastBiometricSync: new Date().toISOString(), homeLocation: { x: 30, y: 40 } },
    { id: 'res5', name: 'Liam Goldberg', apartment: 'D-405', photoUrl: 'https://i.pravatar.cc/150?u=liamgoldberg', biometricConfidence: 98.2, lastBiometricSync: new Date().toISOString(), homeLocation: { x: 80, y: 18 } },
];
const INITIAL_FAMILY_MEMBERS: FamilyMember[] = [
    { id: 'fm1', name: 'Elena Ray', photoUrl: 'https://i.pravatar.cc/150?u=elenaray', status: 'Safe', lastUpdate: new Date().toISOString(), location: OPERATOR_HOME_LOCATION, destinationName: 'Home' },
    { id: 'fm2', name: 'Leo Ray', photoUrl: 'https://i.pravatar.cc/150?u=leoray', status: 'En Route', lastUpdate: new Date().toISOString(), location: { x: 50, y: 50 }, destinationName: 'Playground' },
    { id: 'fm3', name: 'Maya Ray', photoUrl: 'https://i.pravatar.cc/150?u=mayaray', status: 'Safe', lastUpdate: new Date().toISOString(), location: { x: 18, y: 60 }, destinationName: 'Clubhouse' },
];
const INITIAL_SYSTEM_COMPONENTS: SystemComponent[] = [
    { id: 'sys1', name: 'AI Core', status: 'Nominal', details: 'Gemini 2.5 Flash model operational.', value: '0.1ms latency' },
    { id: 'sys2', name: 'Drone Network', status: 'Nominal', details: 'All 6 drones connected and responsive.', value: '100% Uptime' },
    { id: 'sys3', name: 'Surveillance Feeds', status: 'Nominal', details: 'All 4 primary feeds are online.', value: 'HD @ 30fps' },
    { id: 'sys4', name: 'Blockchain Ledger', status: 'Nominal', details: 'Syncing blocks, no forks detected.', value: 'Block #0' },
    { id: 'sys5', name: 'VoicePrint API', status: 'Nominal', details: 'Access point connections stable.', value: '99.9% availability' },
    { id: 'sys6', name: 'NeighborShield Link', status: 'Nominal', details: 'Receiving resident reports.', value: '<5s delay' },
];


const eventIcons: Record<AppEventType, React.ElementType> = {
    anomaly: FiAlertTriangle, breach: FiShield, drone: FiCrosshair,
    registration: FiUsers, deterrent: FiVolume2, access: FiUserCheck,
    report: FiFlag, system: FiCpu, patrol: FiUser,
};

// --- UI COMPONENTS ---
const NotificationToast: React.FC<{ notification: Notification; onDismiss: () => void; }> = ({ notification, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const Icon = notification.iconType ? eventIcons[notification.iconType] : FiBell;
    
    const colors: Record<string, string> = {
        error: 'text-red-400', warning: 'text-yellow-400', info: 'text-cyan-400',
        anomaly: 'text-yellow-400', breach: 'text-red-400', drone: 'text-cyan-400',
        registration: 'text-blue-400', deterrent: 'text-orange-400', access: 'text-green-400',
        report: 'text-purple-400', system: 'text-slate-400', patrol: 'text-blue-400',
    };
    
    const iconColor = colors[notification.type] || (notification.iconType ? colors[notification.iconType] : colors.info);

    return (
        <div className="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-2xl p-3 flex items-center gap-4 w-full animate-fade-in-down border border-slate-700">
            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 ${iconColor}`}>
                <Icon size={18} />
            </div>
            <div className="flex-1 text-sm text-slate-200 font-medium">{notification.message}</div>
            <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300"><FiX size={18} /></button>
        </div>
    );
};

const ChatView: React.FC<{ onPanicPhrase: (phrase: string) => void; isCompact?: boolean; }> = ({ onPanicPhrase, isCompact = false }) => {
    const [messages, setMessages] = useState<Message[]>([{ sender: 'ai', text: "SECUR-E Command Center online. Awaiting directives." }]);
    const [userInput, setUserInput] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const chatRef = useRef<Chat | null>(null);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => { chatRef.current = ai.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction } }); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSendMessage = async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;
        const newUserMessage: Message = { sender: 'user', text: messageText };
        setMessages(prev => [...prev, newUserMessage]);
        setIsLoading(true);
        setUserInput('');
        let currentAiResponse = '';
        try {
            if (!chatRef.current) throw new Error("Chat not initialized.");
            const stream = await chatRef.current.sendMessageStream({ message: messageText });
            let firstChunk = true;
            for await (const chunk of stream) {
                currentAiResponse += chunk.text;
                if(firstChunk){ setMessages(prev => [...prev, { sender: 'ai', text: currentAiResponse }]); firstChunk = false; }
                else { setMessages(prev => { const newMessages = [...prev]; newMessages[newMessages.length - 1].text = currentAiResponse; return newMessages; }); }
            }
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = "Apologies, communication issue detected.";
            setMessages(prev => [...prev, { sender: 'ai', text: errorMessage }]);
        } finally { setIsLoading(false); }
    };

    const handleVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert("Speech recognition is not supported."); return; }
        const recognition = new SpeechRecognition();
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => { console.error(`Speech error: ${event.error}`); setIsListening(false); };
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
            if (transcript.toLowerCase().includes("i'm being followed")) {
                onPanicPhrase(transcript);
                setUserInput('');
            } else {
                setUserInput(transcript);
                if (event.results[0].isFinal) handleSendMessage(transcript);
            }
        };
        recognition.start();
    };

    return (
      <div className="flex flex-col h-full bg-slate-900 border-x border-b border-slate-700 rounded-b-lg">
        <main className={`flex-1 ${isCompact ? 'p-2' : 'p-4 sm:p-6'} overflow-y-auto`}><div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'ai' && <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-cyan-400 flex-shrink-0"><FiShield size={16}/></div>}
                <div className={`max-w-lg p-3 px-4 rounded-2xl shadow-md ${msg.sender === 'user' ? 'bg-cyan-600 text-white rounded-br-lg' : 'bg-slate-800 text-slate-200 rounded-bl-lg'}`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
        </div></main>
        <footer className={`${isCompact ? 'p-2' : 'p-4'} bg-slate-900/80 backdrop-blur-sm border-t border-slate-700`}><form onSubmit={(e) => { e.preventDefault(); handleSendMessage(userInput); }} className="flex items-center gap-2">
            <button type="button" onClick={handleVoiceInput} disabled={isLoading} className={`p-3 rounded-full transition-colors duration-200 ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-700'}`}><FiMic size={20} /></button>
            <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Enter command or speak..." className="flex-1 p-3 input-base rounded-full text-sm" disabled={isLoading}/>
            <button type="submit" disabled={isLoading || !userInput.trim()} className="p-3 bg-cyan-600 text-white rounded-full hover:bg-cyan-500 disabled:opacity-50"><FiSend size={20} /></button>
        </form></footer>
      </div>
    );
};

const feedNames: Record<SurveillanceFeed, string> = { gate: 'Main Gate', perimeter: 'Perimeter Fence', rooftop: 'Rooftop Access', drone: 'Drone Fleet' };
const surveillanceFeedKeys: SurveillanceFeed[] = ['gate', 'perimeter', 'rooftop', 'drone'];

const Battery: React.FC<{ level: number }> = ({ level }) => {
    const clampedLevel = Math.max(0, Math.min(100, level));
    const color = clampedLevel > 50 ? 'bg-green-500' : clampedLevel > 20 ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2">
             <div className="w-6 h-3 border border-slate-400 rounded-sm p-0.5 flex items-center">
                <div className={`${color} h-full rounded-sm`} style={{ width: `${clampedLevel}%` }}></div>
            </div>
            <span className="text-xs font-mono">{Math.round(clampedLevel)}%</span>
        </div>
    );
};

const SurveillanceView: React.FC<{ addEvent: (event: AppEvent) => void; anomalies: Anomaly[]; onAnomaliesDetected: (anomalies: Anomaly[], autonomousHandler: (anomaly: Anomaly) => void) => void; onActivateDeterrent: (target: {x:number, y:number}) => void; onAssignDrone: (target: {x:number, y:number}, description: string) => void; onFlagPerson: (target: {x:number, y:number}, description: string) => void; drones: DroneUnit[]; addNotification: (message: string, type?: Notification['type'], iconType?: AppEventType) => void; autonomousResponseHandler: (anomaly: Anomaly) => void; }> = ({ addEvent, anomalies, onAnomaliesDetected, onActivateDeterrent, onAssignDrone, onFlagPerson, drones, addNotification, autonomousResponseHandler }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [currentFeed, setCurrentFeed] = useState<SurveillanceFeed>('gate');
    const [activeDroneFeedId, setActiveDroneFeedId] = useState<string>('d1');
    const [deterrentActiveFor, setDeterrentActiveFor] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const activeDrone = drones.find(d => d.id === activeDroneFeedId);

    const handleAnalyzeFeed = useCallback(async () => {
        setIsLoading(true); onAnomaliesDetected([], autonomousResponseHandler);
        const prompt = `You are "Crime Crystal Ball", a predictive security AI. Analyzing a feed from: ${feedNames[currentFeed]}. Identify up to 2 potential criminal precursors (loitering, suspicious movements, casing). For each, provide a concise description, its location (x, y from 0-100), and a threat level ('low', 'medium', 'high'). Respond ONLY with a JSON object. If no threats, return an empty array.`;
        const schema = { type: Type.OBJECT, properties: { anomalies: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, threatLevel: { type: Type.STRING } }, required: ["description", "x", "y", "threatLevel"] } } }, required: ["anomalies"] };

        try {
            const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json", responseSchema: schema } });
            const jsonResponse = JSON.parse((response.text || "{}").trim());
            if (jsonResponse?.anomalies && jsonResponse.anomalies.length > 0) {
              const detectedAnomalies: Anomaly[] = jsonResponse.anomalies;
              onAnomaliesDetected(detectedAnomalies, autonomousResponseHandler);
              detectedAnomalies.forEach((a: Anomaly) => {
                const desc = `Predictive Threat (Threat: ${a.threatLevel}): ${a.description}`;
                addEvent(createEvent('anomaly', desc));
              });
            } else { onAnomaliesDetected([], autonomousResponseHandler); }
        } catch (err) { console.error("Analysis failed:", err); } finally { setIsLoading(false); }
    }, [addEvent, onAnomaliesDetected, currentFeed, autonomousResponseHandler]);
    
    const handleDeterrentClick = (anomaly: Anomaly) => { onActivateDeterrent(anomaly); setDeterrentActiveFor(anomaly.description); setTimeout(() => setDeterrentActiveFor(null), 1500); };
    const videoSource = stockVideoUrls[currentFeed];
    
    const droneStatusMap: Record<DroneUnit['status'], string> = {
        'Patrolling': 'DRONE STANDBY', 'Responding': 'RESPONDING TO THREAT', 'Tracking': 'TRACKING TARGET', 'Charging': 'CHARGING', 'Returning to Base': 'RETURNING TO BASE', 'Observing': 'OBSERVING SECTOR'
    };

    return (
      <div className="flex flex-col h-full bg-slate-900 text-slate-200 p-4 sm:p-6 border-x border-b border-slate-700 rounded-b-lg">
        <header className="mb-4 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-bold">{currentFeed === 'drone' ? 'Drone Live Feed' : 'Predictive Surveillance'}</h2>
             <p className="text-sm text-slate-400">
                {currentFeed === 'drone' ? `Sentinel #${activeDrone?.name}` : `Feed: ${feedNames[currentFeed]}`}
            </p>
          </div>
          {currentFeed === 'drone' && activeDrone && <Battery level={activeDrone.battery} />}
        </header>

        {currentFeed === 'drone' && activeDrone ? (
            <div className="flex-1 flex flex-col bg-black border border-slate-700 rounded-lg overflow-hidden">
                <div className="flex-1 relative map-background">
                    {activeDrone.detectedEntities?.map(entity => (
                        <div key={entity.id} style={{left: `${entity.x}%`, top: `${entity.y}%`}} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                            <div className={`w-24 h-12 border-2 rounded-md flex items-end justify-center p-1 ${entity.type === 'Unknown' ? 'border-rose-500' : 'border-cyan-400'}`}>
                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${entity.type === 'Unknown' ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-slate-900'}`}>{entity.type}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <footer className="bg-slate-800/50 p-2 text-center text-lg font-bold tracking-widest text-slate-300">
                    {droneStatusMap[activeDrone.status] || 'DRONE STANDBY'}
                </footer>
            </div>
        ) : (
            <div className="relative w-full aspect-video bg-black border border-slate-700 rounded-lg overflow-hidden mb-4">
              <video key={videoSource} ref={videoRef} autoPlay playsInline muted loop className="w-full h-full object-cover"><source src={videoSource} type="video/mp4" /></video>
              <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><FiRadio className="animate-ping" size={12} />LIVE</div>
              {deterrentActiveFor && <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center text-white text-3xl font-bold animate-pulse">SONIC DETERRENT</div>}
              {anomalies.map((anomaly, index) => (
                <div key={index} style={{ left: `${anomaly.x}%`, top: `${anomaly.y}%` }} className="absolute group transform -translate-x-1/2 -translate-y-1/2">
                  <div className={`w-28 h-20 border-2 rounded-md animate-pulse flex items-center justify-center gap-1 ${anomaly.threatLevel === 'high' ? 'border-rose-500' : 'border-yellow-400'}`}>
                    <button onClick={() => handleDeterrentClick(anomaly)} title="Activate Sonic Deterrent" className="w-8 h-8 bg-blue-500/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"><FiVolume2 /></button>
                    <button onClick={() => onAssignDrone(anomaly, anomaly.description)} title="Assign Drone to Track" className="w-8 h-8 bg-cyan-500/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"><FiCrosshair /></button>
                    <button onClick={() => onFlagPerson(anomaly, anomaly.description)} title="Flag & Observe Person" className="w-8 h-8 bg-purple-500/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"><FiUserPlus /></button>
                  </div>
                  <div className={`absolute bottom-full mb-2 w-max text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${anomaly.threatLevel === 'high' ? 'bg-rose-500' : 'bg-yellow-500'}`}>{anomaly.description}</div>
                </div>
              ))}
            </div>
        )}
        
        <div className="mt-auto pt-4">
             {currentFeed === 'drone' && <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                {drones.map(d => <button key={d.id} onClick={()=>setActiveDroneFeedId(d.id)} className={`p-1.5 rounded text-xs font-semibold transition-colors ${activeDroneFeedId === d.id ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{d.name}</button>)}
            </div>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {surveillanceFeedKeys.map(feed => (<button key={feed} onClick={() => setCurrentFeed(feed)} className={`p-2 rounded-lg text-sm font-semibold transition-colors ${currentFeed === feed ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{feedNames[feed]}</button>))}
            </div>
            {currentFeed !== 'drone' && 
                <button onClick={handleAnalyzeFeed} disabled={isLoading} className="w-full flex items-center justify-center gap-2 p-3 button-primary rounded-lg">{isLoading ? <FiLoader className="animate-spin" /> : <FiTarget />} <span>Scan Current Feed</span></button>
            }
        </div>
      </div>
    );
};

const DroneBaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="40" height="40" className="text-cyan-400 glow-accent">
        <path d="M12 2L4 7v2h16V7L12 2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 13.5c-2.42 0-4.5-1.32-4.5-3.5h9c0 2.18-2.08 3.5-4.5 3.5z"/>
        <path d="M5 12v5h2v-3h10v3h2v-5c0-1.68-1.42-3-3.15-3H8.15C6.42 9 5 10.32 5 12z" opacity="0.6"/>
    </svg>
);

const MapView: React.FC<{ units: AnyUnit[]; anomalies: Anomaly[]; reports: ResidentReport[]; deterrents: DeterrentStation[]; residents: Resident[]; operatorHome: {x: number, y: number}; breachLocation?: { x: number, y: number } | null }> = ({ units, anomalies, reports, deterrents, residents, operatorHome, breachLocation }) => {
    const unitIcons: Record<string, React.ReactElement> = { 
        'Guard': <FiUser size={16} />, 
        'Vehicle': <FiTruck size={16} />, 
        'Drone': <FiCrosshair size={16} />,
        'Police': <FiShield size={16} />
    };
    const statusColors: Record<string, string> = { 
        'Patrolling': 'bg-blue-500', 
        'Stationary': 'bg-slate-600', 
        'Responding': 'bg-orange-500 animate-pulse', 
        'Tracking': 'bg-rose-600 animate-pulse', 
        'Charging': 'bg-yellow-500', 
        'Returning to Base': 'bg-purple-500', 
        'Investigating': 'bg-teal-500', 
        'Observing': 'bg-indigo-500',
        'Apprehending': 'bg-red-700 animate-pulse',
        'Returning to Station': 'bg-cyan-700',
    };
    const activeDrones = units.filter(u => u.type === 'Drone' && u.status !== 'Charging').length;
    
    const mapStatus = anomalies.length > 0 
        ? { text: 'Threats Detected', color: 'text-rose-500' } 
        : { text: 'All Zones Nominal', color: 'text-green-400' };

    return (
        <div className="flex flex-col h-full bg-slate-900 p-4 sm:p-6 overflow-hidden border-x border-b border-slate-700 rounded-b-lg">
            <div className="relative flex-1 w-full map-background rounded-lg overflow-hidden border-2">
                {breachLocation && (
                     <div style={{ left: `${breachLocation.x}%`, top: `${breachLocation.y}%` }} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-rose-500/20 animate-pulse-expand border-2 border-rose-500"></div>
                    </div>
                )}
                
                {Object.values(PATROL_SECTORS).map(sector => (
                    <div key={sector.color} style={{ left: `${sector.x}%`, top: `${sector.y}%`, width: `${sector.w}%`, height: `${sector.h}%`, backgroundColor: sector.color }} className="absolute z-0 pointer-events-none" ></div>
                ))}
                
                {COMMUNITY_LAYOUT.filter(f => f.type === 'road').map(feature => (
                    <div key={feature.id} style={{ left: `${feature.x}%`, top: `${feature.y}%`, width: `${feature.w}%`, height: `${feature.h}%` }} className={`road-base ${feature.w > feature.h ? 'horizontal' : 'vertical'}`} title={feature.name}></div>
                ))}

                {COMMUNITY_LAYOUT.filter(f => f.type !== 'road').map(feature => {
                    const featureStyles: Record<string, string> = {
                        gate: 'bg-slate-700/80 border-cyan-500/80 text-cyan-200', building: 'bg-slate-800/70 border-slate-600/80 text-slate-300', residential: 'bg-slate-800/50 border-slate-700/60 text-slate-400', amenity: 'bg-indigo-900/50 border-indigo-500/80 text-indigo-200', parking: 'bg-slate-700/50 border-slate-600/50 text-slate-400',
                    };
                    const Icon = feature.icon;
                    return (
                        <div key={feature.id} style={{ left: `${feature.x}%`, top: `${feature.y}%`, width: `${feature.w}%`, height: `${feature.h}%` }} className={`absolute border rounded-md flex items-center justify-center text-xs font-semibold p-1 overflow-hidden z-10 ${featureStyles[feature.type] || ''}`} title={feature.name}>
                            {Icon && <Icon className="mr-1 flex-shrink-0" size={14}/>}
                            <span className="truncate relative">{feature.name}</span>
                        </div>
                    );
                })}

                {/* Icons Layer */}
                {residents.map(resident => resident.homeLocation && (
                    <div key={`home-${resident.id}`} style={{ left: `${resident.homeLocation.x}%`, top: `${resident.homeLocation.y}%` }} className="absolute group transform -translate-x-1/2 -translate-y-1/2 z-10" title={`Home of ${resident.name}`}>
                        <FiHome className="text-green-400" size={22} />
                        <span className="hidden group-hover:block absolute bottom-full mb-1 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">{resident.name}</span>
                    </div>
                ))}
                <div style={{ left: `${operatorHome.x}%`, top: `${operatorHome.y}%` }} className="absolute group transform -translate-x-1/2 -translate-y-1/2 z-10" title="Your Home Location">
                    <FiHome className="text-cyan-400 glow-accent" size={28} />
                    <span className="hidden group-hover:block absolute bottom-full mb-1 text-xs bg-cyan-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">Your Home</span>
                </div>
                
                <div style={{left: `${DRONE_BASE.x}%`, top: `${DRONE_BASE.y}%`}} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                    <DroneBaseIcon/>
                    <span className="text-xs bg-black/70 text-white px-2 py-0.5 rounded">Drone Base</span>
                </div>
                {deterrents.map(d => <div key={d.id} style={{left: `${d.location.x}%`, top: `${d.location.y}%`}} className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-20 ${Date.now() - d.lastActivated < 1000 ? 'animate-pulse-deterrent' : ''}`}><FiVolume2 className="text-blue-400 glow-accent" size={24}/></div>)}
                {reports.map(r => (<div key={r.id} style={{ left: `${r.location.x}%`, top: `${r.location.y}%` }} className="absolute group transform -translate-x-1/2 -translate-y-1/2 z-20"><FiFlag className="text-purple-400 glow-accent" size={24} /><span className="hidden group-hover:block absolute bottom-full mb-1 text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">{r.description}</span></div>))}
                {units.filter(u => u.location.y > -5).map(unit => (<div key={unit.id} style={{ left: `${unit.location.x}%`, top: `${unit.location.y}%` }} className="absolute group transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 transition-all duration-1000 linear"><div className={`w-8 h-8 rounded-full border-2 border-white/80 text-white flex items-center justify-center ${statusColors[unit.status] || 'bg-gray-400'}`}>{unitIcons[unit.type]}</div><span className="text-xs bg-black/70 text-white px-1.5 py-0.5 rounded-full mt-1 whitespace-nowrap">{unit.name}</span></div>))}
                {anomalies.map((a, i) => (<div key={i} style={{ left: `${a.x}%`, top: `${a.y}%` }} className="absolute group transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-40"><FiAlertTriangle className={`animate-pulse ${a.threatLevel === 'high' ? 'text-rose-500 glow-danger' : 'text-yellow-400 glow-accent'}`} size={24} /><span className="hidden group-hover:block absolute bottom-full mb-1 text-xs bg-rose-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">{a.description}</span></div>))}
                 <footer className="absolute bottom-0 left-0 right-0 bg-slate-900/80 p-2 px-4 flex justify-between items-center text-sm font-semibold backdrop-blur-sm z-40">
                    <div className={`font-bold ${mapStatus.color}`}>Status: {mapStatus.text}</div>
                    <div className="text-slate-300">Drones: {activeDrones} active</div>
                </footer>
            </div>
        </div>
    );
};

const CommunityFeedView: React.FC<{ messages: GlobalChatMessage[]; isCompact?: boolean; }> = ({ messages, isCompact = false }) => {
    const chatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    return (
        <div className="flex flex-col h-full bg-slate-900 border-x border-b border-slate-700 rounded-b-lg">
            {!isCompact && (
                <header className="p-4 sm:p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><FiRss/> NeighborShield Bulletin</h2>
                    <p className="text-sm text-slate-400">Live community reports and announcements.</p>
                </header>
            )}
            <main className={`flex-1 ${isCompact ? 'p-2' : 'p-4 sm:p-6'} overflow-y-auto`}>
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.residentName === 'SECUR-E Control' ? 'justify-end' : 'justify-start'}`}>
                            {msg.residentName !== 'SECUR-E Control' && <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0"><FiUser size={16}/></div>}
                            <div className={`max-w-lg p-3 px-4 rounded-2xl shadow-md ${msg.residentName === 'SECUR-E Control' ? (msg.text.startsWith("EMERGENCY ALERT") ? 'bg-rose-600 text-white rounded-br-lg' : 'bg-cyan-600 text-white rounded-br-lg') : 'bg-slate-800 text-slate-200 rounded-bl-lg'}`}>
                                {msg.residentName !== 'SECUR-E Control' && <p className="font-bold text-xs text-cyan-400 mb-1">{msg.residentName}</p>}
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                                <p className="text-right text-xs opacity-60 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            {msg.residentName === 'SECUR-E Control' && <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ${msg.text.startsWith("EMERGENCY ALERT") ? 'bg-rose-600' : 'bg-cyan-600'}`}><FiShield size={16}/></div>}
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
            </main>
        </div>
    );
};

const RegistryView: React.FC<{ active: boolean; addResident: (resident: Omit<Resident, 'id' | 'biometricConfidence' | 'lastBiometricSync' | 'homeLocation'>) => void; residents: Resident[] }> = ({ active, addResident, residents }) => {
    const [name, setName] = useState(''); const [apartment, setApartment] = useState(''); const [isScanning, setIsScanning] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null);
    useCamera(videoRef, active);

    const handleRegister = () => {
        if (!name || !apartment || !videoRef.current || !canvasRef.current) return;
        setIsScanning(true);
        setTimeout(() => {
            const video = videoRef.current!; const canvas = canvasRef.current!;
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            addResident({ name, apartment, photoUrl: canvas.toDataURL('image/webp') });
            setName(''); setApartment(''); setIsScanning(false);
        }, 2500);
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 p-4 sm:p-6 overflow-y-auto border-x border-b border-slate-700 rounded-b-lg">
            <header className="mb-4">
                <h2 className="text-xl font-bold text-slate-100">HiveMind Resident Directory</h2>
                <p className="text-sm text-slate-400">Manage self-learning biometric profiles.</p>
            </header>
            <div className="card-base p-4 rounded-lg shadow-lg mb-6">
                <div className="relative w-full aspect-video bg-black border border-slate-700 rounded-md overflow-hidden mb-4">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {isScanning && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-cyan-400"><FiCpu className="animate-pulse" size={48} /><p className="mt-4 text-lg font-semibold">[BIOMETRIC SCAN IN PROGRESS]</p></div>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="w-full p-2 input-base rounded-md text-sm" />
                    <input type="text" value={apartment} onChange={e => setApartment(e.target.value)} placeholder="Apartment / Unit No." className="w-full p-2 input-base rounded-md text-sm" />
                </div>
                <button onClick={handleRegister} disabled={!name || !apartment || isScanning} className="w-full flex items-center justify-center gap-2 p-3 button-primary rounded-lg"><FiCamera /> {isScanning ? "Scanning..." : "Capture & Register Resident"}</button>
            </div>
            <div className="space-y-3">
                {[...residents].reverse().map(resident => (
                     <div key={resident.id} className="flex items-center gap-4 card-base p-3 rounded-lg">
                        <img src={resident.photoUrl} alt={resident.name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-600" />
                        <div className="flex-1"><p className="font-semibold text-slate-200">{resident.name}</p><p className="text-xs text-slate-400">Unit: {resident.apartment}</p></div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Confidence: <span className="font-semibold text-cyan-400">{resident.biometricConfidence}%</span></p>
                            {resident.homeLocation && (
                                <p className="text-xs text-slate-400 flex items-center justify-end gap-1 mt-1">
                                    <FiMapPin size={10} />
                                    <span>[{Math.round(resident.homeLocation.x)}, {Math.round(resident.homeLocation.y)}]</span>
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AccessControlView: React.FC<{ logs: AccessLog[]; onSimulateAccess: () => void; }> = ({ logs, onSimulateAccess }) => (
    <div className="flex flex-col h-full bg-slate-900 p-4 sm:p-6 overflow-y-auto border-x border-b border-slate-700 rounded-b-lg">
        <header className="mb-4">
            <h2 className="text-xl font-bold text-slate-100">VoicePrint Access Control</h2>
            <p className="text-sm text-slate-400">Live feed of all voice-verified entry points.</p>
        </header>
        <div className="mb-4"><button onClick={onSimulateAccess} className="w-full p-3 button-primary rounded-lg">Simulate Gate Access Event</button></div>
        <div className="space-y-3">
            {[...logs].reverse().map(log => (
                <div key={log.id} className="flex items-start gap-4 p-3 card-base rounded-lg">
                    <div className="mt-1">{log.success ? <FiCheckCircle className="text-green-400" /> : <FiXCircle className="text-rose-500" />}</div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-300">{log.location}: <span className={log.success ? "text-green-400" : "text-rose-500"}>{log.success ? "Access Granted" : "Access Denied"}</span></p>
                        <p className="text-sm text-slate-400">{log.description}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const LedgerView: React.FC<{ ledger: Block[] }> = ({ ledger }) => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 p-4 sm:p-6 overflow-y-auto border-x border-b border-slate-700 rounded-b-lg">
        <header className="mb-6 text-center">
            <h2 className="text-2xl font-extrabold text-slate-100 flex items-center justify-center gap-2"><FiDatabase /> Transparency Ledger</h2>
            <p className="text-sm text-slate-400 mt-1">All actions are recorded on this secure, immutable log.</p>
        </header>
        <div className="relative pl-8">
             <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-700"></div>
            <div className="space-y-6">
            {[...ledger].reverse().map((block) => {
                const colors = { anomaly: 'bg-yellow-500', breach: 'bg-rose-500', drone: 'bg-cyan-500', registration: 'bg-blue-500', deterrent: 'bg-orange-500', access: 'bg-green-500', report: 'bg-purple-500', system: 'bg-slate-500', patrol: 'bg-blue-500' };
                const Icon = eventIcons[block.type];
                return (
                <div key={block.id} className="relative">
                    <div className={`absolute -left-8 top-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${colors[block.type] || 'bg-slate-500'} border-2 border-slate-900`}>
                        {Icon && <Icon size={12} />}
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-lg">
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{block.description}</p>
                        <p className="text-xs text-slate-500 mt-2">{new Date(block.timestamp).toLocaleString()}</p>
                        <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-slate-400 hover:text-cyan-400">Cryptographic Details</summary>
                            <div className="font-mono bg-slate-900 p-2 rounded mt-1 space-y-1 overflow-hidden">
                                <p className="truncate"><span className="font-semibold text-slate-400">HASH:</span> <span className="text-green-400">{block.hash}</span></p>
                                <p className="truncate"><span className="font-semibold text-slate-400">PREV:</span> <span className="text-yellow-400">{block.previousHash}</span></p>
                            </div>
                        </details>
                    </div>
                </div>
            )})}
            </div>
        </div>
    </div>
);

const FamilyStatusView: React.FC<{ family: FamilyMember[] }> = ({ family }) => {
    const getStatusInfo = (status: FamilyMember['status']): { color: string; icon: React.ReactElement } => {
        switch (status) {
            case 'Safe': return { color: 'border-green-400 text-green-300', icon: <FiCheckCircle /> };
            case 'En Route': return { color: 'border-blue-400 text-blue-300', icon: <FiTruck /> };
            case 'At Risk': return { color: 'border-rose-500 text-rose-400 animate-pulse', icon: <FiAlertTriangle /> };
            default: return { color: 'border-slate-500 text-slate-400', icon: <FiHelpCircle /> };
        }
    };
    const timeAgo = (dateStr: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        return `${Math.floor(seconds / 60)}m ago`;
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 p-4 sm:p-6 overflow-y-auto border-x border-b border-slate-700 rounded-b-lg">
            <header className="mb-6">
                <h2 className="text-xl font-bold text-slate-100">Family Status Tracker</h2>
                <p className="text-sm text-slate-400">Live location and status of family members.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {family.map(member => {
                    const statusInfo = getStatusInfo(member.status);
                    return (
                        <div key={member.id} className={`card-base p-4 rounded-lg flex flex-col items-center text-center border-t-4 ${statusInfo.color}`}>
                            <img src={member.photoUrl} alt={member.name} className="w-24 h-24 rounded-full object-cover border-4 border-slate-600 mb-4" />
                            <h3 className="text-lg font-bold text-slate-100">{member.name}</h3>
                            <div className={`flex items-center gap-2 font-semibold ${statusInfo.color.split(' ')[1]}`}>
                                {statusInfo.icon}
                                <span>{member.status}</span>
                            </div>
                            <p className="text-sm text-slate-400 mt-2">
                                {member.status === 'En Route' ? `Heading to ${member.destinationName}` : `At ${member.destinationName}`}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Last update: {timeAgo(member.lastUpdate)}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SystemHealthView: React.FC<{ components: SystemComponent[] }> = ({ components }) => {
    const getStatusInfo = (status: SystemComponent['status']): { color: string; icon: React.ReactElement } => {
        switch (status) {
            case 'Nominal': return { color: 'text-green-400', icon: <FiCheckCircle /> };
            case 'Warning': return { color: 'text-yellow-400', icon: <FiAlertTriangle /> };
            case 'Error': return { color: 'text-rose-500', icon: <FiXCircle /> };
            default: return { color: 'text-slate-500', icon: <FiHelpCircle /> };
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 p-4 sm:p-6 overflow-y-auto border-x border-b border-slate-700 rounded-b-lg">
            <header className="mb-6">
                <h2 className="text-xl font-bold text-slate-100">System Health & Operations</h2>
                <p className="text-sm text-slate-400">Real-time status of all SECUR-E system components.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {components.map(comp => {
                    const statusInfo = getStatusInfo(comp.status);
                    return (
                        <div key={comp.id} className="card-base p-4 rounded-lg flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-200">{comp.name}</h3>
                                <div className={`flex items-center gap-1.5 text-sm font-semibold ${statusInfo.color}`}>
                                    {statusInfo.icon} {comp.status}
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 flex-grow">{comp.details}</p>
                            {comp.value && <p className="text-right font-mono text-cyan-400 mt-4 text-lg">{comp.value}</p>}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const DroneFeedPanel: React.FC<{ respondingDrone: DroneUnit | undefined }> = ({ respondingDrone }) => {
    const droneStatusMap: Record<DroneUnit['status'], string> = {
        'Patrolling': 'STANDBY', 'Responding': 'RESPONDING', 'Tracking': 'TRACKING', 'Charging': 'CHARGING', 'Returning to Base': 'RTB', 'Observing': 'OBSERVING'
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg">
            <header className="p-3 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2"><FiVideo/> Drone Feed</h2>
                {respondingDrone && <Battery level={respondingDrone.battery} />}
            </header>
            <div className="flex-1 flex flex-col justify-center items-center p-2">
                {!respondingDrone ? (
                    <div className="text-center text-slate-400">
                        <FiLoader className="animate-spin mx-auto mb-2" size={24}/>
                        <p>Awaiting drone assignment...</p>
                    </div>
                ) : (
                     <div className="w-full h-full flex flex-col bg-black border border-slate-700 rounded-lg overflow-hidden">
                        <div className="flex-1 relative map-background">
                            {respondingDrone.detectedEntities?.map(entity => (
                                <div key={entity.id} style={{left: `${entity.x}%`, top: `${entity.y}%`}} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                    <div className={`w-24 h-12 border-2 rounded-md flex items-end justify-center p-1 ${entity.type === 'Unknown' ? 'border-rose-500' : 'border-cyan-400'}`}>
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${entity.type === 'Unknown' ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-slate-900'}`}>{entity.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <footer className="bg-slate-800/50 p-2 text-center text-lg font-bold tracking-widest text-slate-300">
                           <span className="text-cyan-400">{respondingDrone.name}</span>: <span className={respondingDrone.status === 'Tracking' ? 'text-rose-400 animate-pulse' : 'text-slate-300'}>{droneStatusMap[respondingDrone.status] || 'STANDBY'}</span>
                        </footer>
                    </div>
                )}
            </div>
        </div>
    );
};

const EmergencyDashboardView: React.FC<{
    breachDetails: Anomaly;
    units: AnyUnit[];
    residents: Resident[];
    reports: ResidentReport[];
    deterrents: DeterrentStation[];
    globalChat: GlobalChatMessage[];
    onEndProtocol: () => void;
    operatorHome: {x: number, y: number};
}> = ({ breachDetails, units, residents, reports, deterrents, globalChat, onEndProtocol, operatorHome }) => {
    
    const respondingDrone = units.find((u): u is DroneUnit => u.type === 'Drone' && u.missionDescription === breachDetails.description);
    const robberyOngoing = breachDetails.isRobbery;

    return (
        <div className="w-full h-full flex flex-col emergency-view text-white p-2">
            <header className="flex-shrink-0 flex justify-between items-center p-2 border-b-2 border-rose-500/80">
                <h1 className="text-xl font-bold text-rose-400 animate-pulse glow-danger flex items-center gap-2">
                    <FiAlertTriangle/> {breachDetails.description.toUpperCase()}
                </h1>
                <button onClick={onEndProtocol} disabled={robberyOngoing} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg font-bold text-lg disabled:bg-slate-600 disabled:cursor-not-allowed">
                    {robberyOngoing ? "INCIDENT ACTIVE" : "SECURE & DEACTIVATE"}
                </button>
            </header>
            <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-y-auto">
                <div className="lg:col-span-2 h-[40vh] min-h-[300px]">
                    <MapView units={units} anomalies={breachDetails ? [breachDetails] : []} reports={reports} deterrents={deterrents} residents={residents} operatorHome={operatorHome} breachLocation={breachDetails} />
                </div>
                <div className="h-96 min-h-[300px]">
                     <DroneFeedPanel respondingDrone={respondingDrone} />
                </div>
                <div className="h-96 min-h-[300px]">
                     <CommunityFeedView messages={globalChat} isCompact={true} />
                </div>
                 <div className="h-96 min-h-[300px] lg:col-span-2">
                     <ChatView onPanicPhrase={() => {}} isCompact={true} />
                </div>
            </main>
        </div>
    );
};


// --- MAIN APP ---
const App: React.FC = () => {
    const [activeView, setActiveView] = useState<View>('map');
    const [residents, setResidents] = useState<Resident[]>([]);
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(INITIAL_FAMILY_MEMBERS);
    const [systemComponents, setSystemComponents] = useState<SystemComponent[]>(INITIAL_SYSTEM_COMPONENTS);
    const [units, setUnits] = useState<AnyUnit[]>([]);
    const [ledger, setLedger] = useState<Block[]>([]);
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [isBreachProtocolActive, setIsBreachProtocolActive] = useState(false);
    const [breachDetails, setBreachDetails] = useState<Anomaly | null>(null);
    const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
    const [residentReports, setResidentReports] = useState<ResidentReport[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [globalChat, setGlobalChat] = useState<GlobalChatMessage[]>([]);
    const [deterrentStations, setDeterrentStations] = useState<DeterrentStation[]>(DETERRENT_STATIONS);
    
    const addNotification = useCallback((message: string, type: Notification['type'] = 'info', iconType?: AppEventType) => {
        const id = Date.now().toString() + Math.random();
        const newNotification: Notification = { id, message, type, iconType };
        setNotifications(prev => [...prev.slice(-2), newNotification]);
    }, []);

    const addEvent = useCallback((event: AppEvent) => {
        setLedger(prevLedger => {
            const previousHash = prevLedger.length > 0 ? prevLedger[prevLedger.length - 1].hash : 'h00000000';
            const hash = simpleSyncHash(event.id + event.timestamp + event.description + previousHash);
            const newBlock: Block = { ...event, previousHash, hash };
            const updatedLedger = [...prevLedger, newBlock];
            localStorage.setItem('secur-e-ledger-v3', JSON.stringify(updatedLedger));
            return updatedLedger;
        });
    }, []);
    
    const findClosestAvailableDrone = (target: {x: number, y: number}, units: AnyUnit[]): DroneUnit | null => {
        const availableDrones = units.filter((u): u is DroneUnit => u.type === 'Drone' && (u.status === 'Patrolling' || u.status === 'Returning to Base' || u.status === 'Observing'));
        if (availableDrones.length === 0) return null;
        
        let closestDrone: DroneUnit | null = null;
        let minDistance = Infinity;
        availableDrones.forEach(drone => {
            const dist = Math.hypot(target.x - drone.location.x, target.y - drone.location.y);
            if (dist < minDistance) {
                minDistance = dist;
                closestDrone = drone;
            }
        });
        return closestDrone;
    };

    const handleAssignDrone = useCallback((target: {x: number, y: number}, description: string, autonomous: boolean = false) => {
        setUnits(prev => {
            const droneToAssign = findClosestAvailableDrone(target, prev);
            if(!droneToAssign) { 
                addNotification("No drones available for assignment.", 'warning', 'drone'); 
                return prev; 
            }
            const desc = `${autonomous ? 'AUTONOMOUS: ' : ''}${droneToAssign.name} assigned to threat: ${description}.`;
            addEvent(createEvent('drone', desc));
            addNotification(desc, 'info', 'drone');
            return prev.map(u => {
                if (u.id === droneToAssign.id && u.type === 'Drone') {
                    return { ...u, status: 'Tracking', missionTarget: {x: target.x, y: target.y}, missionDescription: description };
                }
                return u;
            });
        });
    }, [addEvent, addNotification]);

    const handleFlagPerson = useCallback((target: {x: number, y: number}, description: string) => {
        setUnits(prev => {
            const droneToAssign = findClosestAvailableDrone(target, prev);
            if(!droneToAssign) { 
                addNotification("No drones available for observation.", 'warning', 'drone'); 
                return prev; 
            }
            const desc = `${droneToAssign.name} assigned to observe person of interest: ${description}.`;
            addEvent(createEvent('drone', desc));
            addNotification(desc, 'info', 'drone');
            return prev.map(u => {
                if (u.id === droneToAssign.id && u.type === 'Drone') {
                    return { ...u, status: 'Observing', missionTarget: {x: target.x, y: target.y}, missionDescription: description, observationStartTime: Date.now() };
                }
                return u;
            });
        });
    }, [addEvent, addNotification]);

    const handleActivateDeterrent = useCallback((target: {x: number, y: number}, autonomous: boolean = false) => {
        let closestStationId: string | null = null;
        let minDistance = Infinity;
        deterrentStations.forEach(station => {
            const distance = Math.hypot(station.location.x - target.x, station.location.y - target.y);
            if (distance < minDistance) {
                minDistance = distance;
                closestStationId = station.id;
            }
        });
        if (closestStationId) {
            setDeterrentStations(prev => prev.map(s => s.id === closestStationId ? { ...s, lastActivated: Date.now() } : s));
            const desc = `${autonomous ? 'AUTONOMOUS: ' : ''}Sonic deterrent activated near [${target.x.toFixed(0)}, ${target.y.toFixed(0)}]`;
            addEvent(createEvent('deterrent', desc));
            addNotification(desc, 'info', 'deterrent');
        }
    }, [deterrentStations, addEvent, addNotification]);
    
    const handleAssignPatrol = useCallback((target: { x: number; y: number }, description: string, status: PatrolUnit['status'], autonomous: boolean = false) => {
        setUnits(prev => {
            const availablePatrols = prev.filter((u): u is PatrolUnit => (u.type === 'Guard' || u.type === 'Vehicle') && u.status === 'Patrolling');
            if(availablePatrols.length === 0) return prev;

            let closestPatrol: PatrolUnit | null = null;
            let minDistance = Infinity;
            availablePatrols.forEach(p => {
                 const dist = Math.hypot(target.x - p.location.x, target.y - p.location.y);
                 if(dist < minDistance) {
                     minDistance = dist;
                     closestPatrol = p;
                 }
            });
            if(!closestPatrol) return prev;
            
            const patrolToAssign = closestPatrol;
            const desc = `${autonomous ? 'AUTONOMOUS: ' : ''}${patrolToAssign.name} assigned to ${description}.`;
            addEvent(createEvent('patrol', desc));
            addNotification(desc, 'info', 'patrol');
            return prev.map(u => {
                if (u.id === patrolToAssign.id && (u.type === 'Guard' || u.type === 'Vehicle')) {
                    return {...u, status, missionTarget: target, missionDescription: description, path: []};
                }
                return u;
            });
        });
    }, [addEvent, addNotification]);
    
    const handleDispatchPolice = useCallback((target: { x: number; y: number }, description: string) => {
        setUnits(prevUnits => {
            const policeUnit = prevUnits.find((u): u is PatrolUnit => u.type === 'Police');
            if (policeUnit && policeUnit.status === 'Stationary') {
                const desc = `Police unit ${policeUnit.name} dispatched to incident, entering via Main Gate.`;
                addEvent(createEvent('patrol', desc));
                addNotification(desc, 'warning', 'patrol');
                return prevUnits.map(u => 
                    u.id === policeUnit.id 
                    ? { ...u, status: 'Responding', location: { ...MAIN_GATE_ENTRANCE }, missionTarget: target, missionDescription: description, path: [] } 
                    : u
                );
            } else {
                addNotification('Police unavailable. Dispatching nearest security patrol.', 'warning', 'patrol');
                handleAssignPatrol(target, description, 'Responding', true);
                return prevUnits;
            }
        });
    }, [addEvent, addNotification, handleAssignPatrol]);

    const triggerBreachProtocol = useCallback((details: Anomaly, autonomous: boolean = false) => {
        if(isBreachProtocolActive) return;
        const desc = `${autonomous ? 'AUTONOMOUS: ' : ''}EMERGENCY PROTOCOL ACTIVE: ${details.description}`;
        addEvent(createEvent('breach', desc));
        addNotification(desc, 'error', 'breach');
        setBreachDetails(details);
        setIsBreachProtocolActive(true);
    }, [addEvent, addNotification, isBreachProtocolActive]);

    const handleAutonomousResponse = useCallback((anomaly: Anomaly) => {
        switch (anomaly.threatLevel) {
            case 'high':
                triggerBreachProtocol(anomaly, true);
                handleAssignDrone({x: anomaly.x, y: anomaly.y}, anomaly.description, true);
                handleActivateDeterrent({x: anomaly.x, y: anomaly.y}, true);
                if (anomaly.isRobbery) {
                    handleDispatchPolice({x: anomaly.x, y: anomaly.y}, anomaly.description);
                    const nearestBuilding = getNearestBuildingName(anomaly.x, anomaly.y);
                    const warningMessage: GlobalChatMessage = {
                        id: Date.now().toString(),
                        residentName: 'SECUR-E Control',
                        text: `EMERGENCY ALERT: Active security incident reported near ${nearestBuilding}. Please stay indoors and await further instructions.`,
                        timestamp: new Date().toISOString()
                    };
                    setGlobalChat(prev => [...prev, warningMessage]);
                } else {
                    handleAssignPatrol({x: anomaly.x, y: anomaly.y}, anomaly.description, 'Responding', true);
                }
                break;
            case 'medium':
                 addNotification(`AUTONOMOUS: Medium threat detected. Activating deterrent and dispatching patrol to investigate.`, 'warning', 'anomaly');
                 handleActivateDeterrent({x: anomaly.x, y: anomaly.y}, true);
                 handleAssignPatrol({x: anomaly.x, y: anomaly.y}, "investigate area", 'Investigating', true);
                break;
            case 'low':
                addNotification(`Predictive Threat (Threat: low): ${anomaly.description}`, 'info', 'anomaly');
                break;
        }
    }, [triggerBreachProtocol, handleAssignDrone, handleActivateDeterrent, handleAssignPatrol, handleDispatchPolice, addNotification]);
    
    useEffect(() => {
        const storedResidents = JSON.parse(localStorage.getItem('secur-e-residents-v2') || 'null');
        setResidents(storedResidents || INITIAL_RESIDENTS);

        const storedLedger = JSON.parse(localStorage.getItem('secur-e-ledger-v3') || '[]');
        setLedger(storedLedger.length > 0 ? storedLedger : [{ id: '0', timestamp: new Date(0).toISOString(), type: 'system', description: 'Genesis Block - Ledger Initialized', previousHash: 'h00000000', hash: simpleSyncHash('Genesis Block') }]);
        setAccessLogs(JSON.parse(localStorage.getItem('secur-e-access-logs-v1') || '[]'));
        
        const droneSectors: PatrolSector[] = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Alpha', 'Bravo'];
        setUnits([
            { id: 'p1', name: 'Patrol 1', type: 'Guard', status: 'Patrolling', location: { x: 20, y: 88 } },
            { id: 'v1', name: 'Vehicle 1', type: 'Vehicle', status: 'Patrolling', location: { x: 70, y: 88 } },
            { id: 'police1', name: 'Police-1', type: 'Police', status: 'Stationary', location: { ...OFF_MAP_STATION } },
            ...Array.from({ length: 6 }, (_, i) => ({ id: `d${i+1}`, name: `DG-${i+7}`, type: 'Drone' as const, status: 'Patrolling' as const, location: { x: 45 + i*4, y: 85 }, battery: 80 + Math.random()*20, detectedEntities: [], patrolSector: droneSectors[i] }))
        ]);
        const startMessage = 'System Online. All units deployed.';
        addEvent(createEvent('system', startMessage));
    }, [addEvent]);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setUnits(prevUnits => prevUnits.map(unit => {
                let newUnit: AnyUnit = JSON.parse(JSON.stringify(unit)); // Deep copy to avoid mutation issues

                if (newUnit.status === 'Apprehending' && (newUnit.type === 'Police' || newUnit.type === 'Guard' || newUnit.type === 'Vehicle')) {
                    newUnit.apprehendingTimer = (newUnit.apprehendingTimer || 0) + 1;
                    if (newUnit.apprehendingTimer >= 2) { // Takes 2 ticks (4s) to apprehend
                        const targetAnomaly = anomalies.find(a => a.description === newUnit.missionDescription);
                        if (targetAnomaly) {
                             setAnomalies(prev => prev.filter(a => a.description !== targetAnomaly.description));
                             const desc = `Suspect apprehended by ${newUnit.name}. Scene is secure.`;
                             addEvent(createEvent('patrol', desc)); addNotification(desc, 'info', 'patrol');
                             setBreachDetails(null); // Clear breach details
                        }
                        newUnit.status = newUnit.type === 'Police' ? 'Returning to Station' : 'Patrolling';
                        newUnit.missionTarget = newUnit.type === 'Police' ? MAIN_GATE_ENTRANCE : undefined;
                        newUnit.missionDescription = undefined;
                        newUnit.path = [];
                        newUnit.apprehendingTimer = 0;
                    }
                    return newUnit;
                }

                if (newUnit.type === 'Guard' || newUnit.type === 'Vehicle' || (newUnit.type === 'Police' && newUnit.status !== 'Stationary')) {
                    if (newUnit.missionTarget && (!newUnit.path || newUnit.path.length === 0)) {
                        const startNodeId = getNearestRoadNode(newUnit.location.x, newUnit.location.y);
                        const endNodeId = getNearestRoadNode(newUnit.missionTarget.x, newUnit.missionTarget.y);
                        const nodePathIds = findPath(startNodeId, endNodeId);
                        
                        if (nodePathIds.length > 0) {
                            const coordPath = nodePathIds.map(id => ROAD_NODES[id as keyof typeof ROAD_NODES]);
                            const lastNode = coordPath[coordPath.length - 1];
                            if (Math.hypot(lastNode.x - newUnit.missionTarget.x, lastNode.y - newUnit.missionTarget.y) > 1) {
                                coordPath.push(newUnit.missionTarget);
                            }
                            newUnit.path = coordPath;
                        }
                    }
                    else if (newUnit.status === 'Patrolling' && (!newUnit.path || newUnit.path.length === 0)) {
                        const allNodeIds = Object.keys(ROAD_NODES);
                        const randomNodeId = allNodeIds[Math.floor(Math.random() * allNodeIds.length)];
                        const startNodeId = getNearestRoadNode(newUnit.location.x, newUnit.location.y);
                        if(startNodeId !== randomNodeId) {
                           const nodePathIds = findPath(startNodeId, randomNodeId);
                           newUnit.path = nodePathIds.map(id => ROAD_NODES[id as keyof typeof ROAD_NODES]);
                        }
                    }
                }

                let target: {x: number, y: number} | undefined = newUnit.missionTarget;
                if (newUnit.path && newUnit.path.length > 0) { target = newUnit.path[0]; }
                
                if (newUnit.type === 'Drone') {
                    if (newUnit.status === 'Charging') { newUnit.battery = Math.min(100, newUnit.battery + 1.5); if (newUnit.battery >= 100) newUnit.status = 'Patrolling';
                    } else { newUnit.battery -= (newUnit.status === 'Tracking' || newUnit.status === 'Observing') ? 0.3 : 0.1; if (newUnit.battery <= 0) { newUnit.status = 'Charging'; newUnit.location = { ...DRONE_BASE }; newUnit.missionTarget = undefined; newUnit.battery = 0; } else if (newUnit.battery < 20 && !['Tracking', 'Returning to Base', 'Charging'].includes(newUnit.status)) { newUnit.status = 'Returning to Base'; } }
                    if (newUnit.status === 'Observing' && newUnit.observationStartTime && Date.now() - newUnit.observationStartTime > 8000) { newUnit.status = 'Patrolling'; newUnit.observationStartTime = undefined; newUnit.missionDescription = undefined; newUnit.detectedEntities = []; } else if (newUnit.status !== 'Observing' && newUnit.detectedEntities && newUnit.detectedEntities.length > 0) { newUnit.detectedEntities = []; }
                    if (newUnit.status === 'Returning to Base') target = DRONE_BASE;
                    if (!target && newUnit.status === 'Patrolling' && newUnit.patrolSector) {
                        const sector = PATROL_SECTORS[newUnit.patrolSector];
                        target = { x: sector.x + Math.random() * sector.w, y: sector.y + Math.random() * sector.h, };
                    } else if (!target && newUnit.status === 'Patrolling') {
                        target = { x: 10 + Math.random() * 80, y: 10 + Math.random() * 80 };
                    }
                }
                
                if (newUnit.type === 'Police' && newUnit.status === 'Returning to Station') target = MAIN_GATE_ENTRANCE;
                
                if (target) {
                    const dist = Math.hypot(target.x - newUnit.location.x, target.y - newUnit.location.y);
                    const arrivalThreshold = 1.5;

                    if (dist < arrivalThreshold) {
                        if (newUnit.path && newUnit.path.length > 0) {
                            newUnit.path.shift(); if (newUnit.path.length > 0) { return newUnit; }
                        }

                        const missionDesc = newUnit.missionDescription;
                        const targetAnomaly = anomalies.find(a => a.description === missionDesc);

                        if (newUnit.type === 'Police' && newUnit.status === 'Returning to Station' && newUnit.location.y < 15) {
                            newUnit.status = 'Stationary'; newUnit.location = { ...OFF_MAP_STATION }; newUnit.missionTarget = undefined; newUnit.path = undefined;
                        } else if (newUnit.type !== 'Drone' && newUnit.status === 'Responding' && targetAnomaly?.isRobbery) {
                                newUnit.status = 'Apprehending'; newUnit.path = undefined; newUnit.missionTarget = newUnit.location; newUnit.apprehendingTimer = 0;
                        } else {
                            newUnit.missionTarget = undefined; newUnit.path = [];
                             if (newUnit.type === 'Drone') {
                                if (newUnit.status === 'Patrolling' || newUnit.status === 'Tracking') {
                                    newUnit.status = 'Observing'; newUnit.observationStartTime = Date.now();
                                    newUnit.detectedEntities = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({ id: `de${Date.now()}${i}`, type: Math.random() > 0.4 ? 'Resident' : 'Unknown', x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 }));
                                } else if (newUnit.status === 'Returning to Base') newUnit.status = 'Charging';
                            } else { newUnit.status = 'Patrolling'; }
                        }
                    } else { 
                        let speed = newUnit.type === 'Drone' ? 0.1 : 0.25;
                        if ((newUnit.type === 'Police' || newUnit.type === 'Vehicle') && newUnit.status === 'Responding') speed = 0.5;
                        if(newUnit.type === 'Guard' && newUnit.status === 'Responding') speed = 0.35;
                        newUnit.location = { x: newUnit.location.x + (target.x - newUnit.location.x) * speed, y: newUnit.location.y + (target.y - newUnit.location.y) * speed };
                    }
                }
                
                return newUnit;
            }));

            if (Math.random() < 0.002 && residentReports.some(r => r.description.includes("Suspicious"))) {
                const report = residentReports.find(r => r.description.includes("Suspicious"));
                const isRobberyOngoing = anomalies.some(a => a.isRobbery);
                if (report && !isRobberyOngoing) {
                    const robberyAnomaly: Anomaly = { description: "Robbery in progress!", x: report.location.x, y: report.location.y, threatLevel: 'high', isRobbery: true };
                    setAnomalies(prev => [...prev, robberyAnomaly]);
                    handleAutonomousResponse(robberyAnomaly);
                    setResidentReports(prev => prev.filter(r => r.id !== report.id));
                }
            }

            if (Math.random() < 0.05) {
                const newReport: ResidentReport = { id: Date.now().toString(), timestamp: new Date().toISOString(), location: { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 }, description: "Suspicious person sighted." };
                setResidentReports(prev => [...prev.slice(-5), newReport]);
                const desc = `NeighborShield Report: ${newReport.description} at [${newReport.location.x.toFixed(0)}, ${newReport.location.y.toFixed(0)}]`;
                addEvent(createEvent('report', desc)); addNotification(desc, 'info', 'report');
            }
            if (Math.random() < 0.1) {
                 const newMessage: GlobalChatMessage = { id: Date.now().toString(), residentName: FAKE_RESIDENT_NAMES[Math.floor(Math.random() * FAKE_RESIDENT_NAMES.length)], text: FAKE_MESSAGES[Math.floor(Math.random() * FAKE_MESSAGES.length)], timestamp: new Date().toISOString() };
                setGlobalChat(prev => [...prev.slice(-50), newMessage]);
            }
            if (Math.random() < 0.04) {
                setResidents(prev => {
                    if (prev.length === 0) return prev;
                    const residentToUpdateIndex = Math.floor(Math.random() * prev.length);
                    const updatedResidents = [...prev];
                    const resident = updatedResidents[residentToUpdateIndex];
                    const oldConfidence = resident.biometricConfidence;
                    const newConfidence = Math.max(98, Math.min(99.9, oldConfidence + (Math.random() - 0.5) * 0.2));
                    updatedResidents[residentToUpdateIndex] = { ...resident, biometricConfidence: parseFloat(newConfidence.toFixed(1)), lastBiometricSync: new Date().toISOString() };
                    const desc = `SYSTEM: HiveMind recalibrated profile for ${resident.name}. Confidence: ${oldConfidence.toFixed(1)}% -> ${newConfidence.toFixed(1)}%`;
                    addNotification(desc, 'info', 'system'); addEvent(createEvent('system', desc));
                    return updatedResidents;
                });
            }
             if (Math.random() < 0.1) { // Simulate family and system updates
                setFamilyMembers(prev => prev.map(m => ({ ...m, lastUpdate: new Date().toISOString() }))); // Just update timestamp for now
                setSystemComponents(prev => prev.map(c => {
                    if (c.id === 'sys4') return { ...c, value: `Block #${ledger.length}` };
                    return c;
                }))
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [addEvent, addNotification, anomalies, residentReports, handleAutonomousResponse, ledger.length]);

    const addResident = (residentData: Omit<Resident, 'id' | 'biometricConfidence' | 'lastBiometricSync' | 'homeLocation'>) => {
        const homeLocation = getHomeLocationForApartment(residentData.apartment);
        const newResident: Resident = { 
            ...residentData, 
            id: Date.now().toString(), 
            biometricConfidence: 98.5 + (Math.random()*1.5), 
            lastBiometricSync: new Date().toISOString(),
            homeLocation
        };
        setResidents(prev => { const u = [...prev, newResident]; localStorage.setItem('secur-e-residents-v2', JSON.stringify(u)); return u; });
        const desc = `New resident registered: ${newResident.name}.`;
        addEvent(createEvent('registration', desc));
        addNotification(desc, 'info', 'registration');
    };

    const handleSimulateAccess = () => {
        const success = Math.random() > 0.2;
        const resident = residents[Math.floor(Math.random() * residents.length)];
        const log: AccessLog = { id: Date.now().toString(), timestamp: new Date().toISOString(), location: 'Main Gate', success, description: success ? `VoicePrint verified for ${resident.name}.` : `VoicePrint mismatch. Access denied.` };
        setAccessLogs(prev => { const u = [...prev.slice(-99), log]; localStorage.setItem('secur-e-access-logs-v1', JSON.stringify(u)); return u; });
        addEvent(createEvent('access', log.description));
        addNotification(log.description, 'info', 'access');
    };

    const handlePanicPhrase = (phrase: string) => { 
        const anomaly = { description: `Panic Phrase: "${phrase}"`, x: 50, y: 50, threatLevel: 'high' as const, isRobbery: true };
        handleAutonomousResponse(anomaly);
    };
    
    const handleSOS = () => {
        const anomaly: Anomaly = { description: `SOS Signal from Operator`, x: OPERATOR_HOME_LOCATION.x, y: OPERATOR_HOME_LOCATION.y, threatLevel: 'high', isRobbery: true };
        triggerBreachProtocol(anomaly, false);
        handleDispatchPolice({x: anomaly.x, y: anomaly.y}, anomaly.description);
        const warningMessage: GlobalChatMessage = {
            id: Date.now().toString(),
            residentName: 'SECUR-E Control',
            text: `EMERGENCY ALERT: Active security incident reported. Please stay indoors and await further instructions.`,
            timestamp: new Date().toISOString()
        };
        setGlobalChat(prev => [...prev, warningMessage]);
    }
    
    const handleAnomaliesDetected = (newAnomalies: Anomaly[], autonomousHandler: (anomaly: Anomaly) => void) => {
        setAnomalies(newAnomalies);
        if (newAnomalies.length > 0) {
            newAnomalies.forEach(autonomousHandler);
        }
    };
    
    const endBreachProtocol = () => {
        if(breachDetails || anomalies.some(a => a.isRobbery)) return; // Can't end protocol if threat is still active
        const desc = 'Emergency Protocol deactivated. All units returning to patrol status.';
        addEvent(createEvent('system', desc));
        addNotification(desc, 'info', 'system');
        setIsBreachProtocolActive(false);
        setUnits(prev => prev.map((u): AnyUnit => {
            switch (u.type) {
                case 'Police':
                    return { ...u, status: 'Stationary', location: { ...OFF_MAP_STATION }, missionTarget: undefined, missionDescription: undefined, path: undefined };
                case 'Guard': case 'Vehicle':
                    return { ...u, status: 'Patrolling', missionTarget: undefined, missionDescription: undefined, path: undefined };
                case 'Drone':
                     return { ...u, status: 'Patrolling', missionTarget: undefined, missionDescription: undefined };
            }
        }));
    };
    
    useEffect(() => {
        // Automatically end breach protocol if all robbery anomalies are cleared
        if (isBreachProtocolActive && !anomalies.some(a => a.isRobbery)) {
            endBreachProtocol();
        }
    }, [anomalies, isBreachProtocolActive]);

    const viewTitles: Record<View, string> = {
        map: "Community Security Map",
        surveillance: "Predictive Surveillance",
        chat: "AI Command",
        family: "Family Status",
        system: "System Health",
        community: "Community Bulletin",
        registry: "Resident Registry",
        access: "Access Control",
        ledger: "Action Ledger",
    };

    const renderView = () => {
        switch (activeView) {
            case 'chat': return <ChatView onPanicPhrase={handlePanicPhrase} />;
            case 'surveillance': return <SurveillanceView addEvent={addEvent} anomalies={anomalies} onAnomaliesDetected={handleAnomaliesDetected} onActivateDeterrent={handleActivateDeterrent} onAssignDrone={handleAssignDrone} onFlagPerson={handleFlagPerson} drones={units.filter(u => u.type === 'Drone') as DroneUnit[]} addNotification={addNotification} autonomousResponseHandler={handleAutonomousResponse} />;
            case 'map': return <MapView units={units} anomalies={anomalies} reports={residentReports} deterrents={deterrentStations} residents={residents} operatorHome={OPERATOR_HOME_LOCATION}/>;
            case 'registry': return <RegistryView active={activeView === 'registry'} addResident={addResident} residents={residents} />;
            case 'access': return <AccessControlView logs={accessLogs} onSimulateAccess={handleSimulateAccess} />;
            case 'ledger': return <LedgerView ledger={ledger} />;
            case 'community': return <CommunityFeedView messages={globalChat} />;
            case 'family': return <FamilyStatusView family={familyMembers} />;
            case 'system': return <SystemHealthView components={systemComponents} />;
            default: return null;
        }
    };
    
    const NavButton: React.FC<{ view: View; label: string; icon: React.ElementType }> = ({ view, label, icon: Icon }) => (
        <button onClick={() => setActiveView(view)} title={label} className={`flex-1 flex flex-col items-center justify-center py-3 text-xs transition-colors relative group ${activeView === view ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-400'}`}>
            <Icon size={24} />
            {activeView === view && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-cyan-400 rounded-full nav-active-indicator"></div>}
        </button>
    );

    return (
        <div className="h-screen w-screen flex justify-center items-center p-0 sm:p-4 font-sans">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-full max-w-md px-4 pointer-events-none">
                {notifications.map(n => (
                    <div key={n.id} className="pointer-events-auto">
                        <NotificationToast notification={n} onDismiss={() => setNotifications(p => p.filter(item => item.id !== n.id))} />
                    </div>
                ))}
            </div>
            <div className={`w-full h-full max-w-6xl app-shell sm:border sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isBreachProtocolActive ? 'emergency-mode' : ''}`}>
                 {!isBreachProtocolActive && (
                    <header className="flex-shrink-0 bg-slate-900 border-b border-slate-700 flex justify-between items-center p-3 sm:p-4">
                        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                           <FiShield className="text-cyan-400"/>
                           <span>{viewTitles[activeView] || 'SECUR-E'}</span>
                        </h1>
                        <button onClick={handleSOS} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg font-bold text-white transition-all duration-200 transform hover:scale-105 shadow-lg">
                            <FiAlertTriangle size={18} />
                            <span className="hidden sm:inline">SOS</span>
                        </button>
                    </header>
                )}
                <div className="flex-grow relative overflow-hidden">
                    {isBreachProtocolActive && breachDetails ? (
                        <EmergencyDashboardView 
                            breachDetails={breachDetails}
                            units={units}
                            residents={residents}
                            reports={residentReports}
                            deterrents={deterrentStations}
                            globalChat={globalChat}
                            onEndProtocol={endBreachProtocol}
                            operatorHome={OPERATOR_HOME_LOCATION}
                        />
                    ) : (
                        renderView()
                    )}
                </div>
                {!isBreachProtocolActive && (
                    <nav className="w-full bg-slate-800/80 backdrop-blur-sm border-t border-slate-700 flex justify-around">
                        <NavButton view="map" label="Map" icon={FiMap} />
                        <NavButton view="surveillance" label="Feeds" icon={FiVideo} />
                        <NavButton view="chat" label="AI Chat" icon={FiMessageSquare} />
                        <NavButton view="family" label="Family" icon={FiHeart} />
                        <NavButton view="system" label="System" icon={FiHardDrive} />
                        <NavButton view="community" label="Bulletin" icon={FiRss} />
                        <NavButton view="registry" label="Residents" icon={FiUsers} />
                        <NavButton view="access" label="Access" icon={FiLock} />
                        <NavButton view="ledger" label="Ledger" icon={FiGitBranch} />
                    </nav>
                )}
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
