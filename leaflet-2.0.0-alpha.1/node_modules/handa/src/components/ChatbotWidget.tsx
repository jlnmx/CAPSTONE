import React, { useEffect, useMemo, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@hooks/useAuth';

const GREEN = '#218B25';
const QUICK_PROMPTS = ['How do I report an incident?', 'What should I do during a flood?', 'How do evacuation status updates work?'];

type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string };

function answerQuestion(question: string): string {
  const normalized = question.toLowerCase();
  if (normalized.includes('report') || normalized.includes('incident')) {
    return 'Open Report incident from the resident Quick Actions, choose the incident type and severity, describe what happened, confirm your location, then post the report. Responders can acknowledge it and add response details.';
  }
  if (normalized.includes('flood') || normalized.includes('water')) {
    return 'Move to higher ground when warned, never walk or drive through moving floodwater, avoid downed power lines, and follow official evacuation instructions. Bring essential medication, water, a charged phone, and identification.';
  }
  if (normalized.includes('earthquake')) {
    return 'Drop, Cover, and Hold On. Stay away from windows and tall furniture, expect aftershocks, leave damaged buildings, and follow official instructions before returning.';
  }
  if (normalized.includes('fire')) {
    return 'Alert others, leave immediately using the safest exit, stay low under smoke, never use an elevator, call emergency services from a safe place, and do not re-enter.';
  }
  if (normalized.includes('typhoon') || normalized.includes('storm') || normalized.includes('rain')) {
    return 'Monitor official advisories, charge phones and power banks, prepare a go bag, secure loose objects, avoid unnecessary travel, and evacuate early when authorities advise it.';
  }
  if (normalized.includes('status') || normalized.includes('checked') || normalized.includes('evacuat')) {
    return 'MY STATUS shows SAFE until an evacuation registration is checked in. It changes to CHECKED-IN, EVACUATED, or RELEASED as responders update your household registration.';
  }
  if (normalized.includes('household') || normalized.includes('member')) {
    return 'Tap HOUSEHOLD on the resident dashboard to add, edit, or remove household members. Changes are saved to the database immediately and are available during evacuation registration.';
  }
  if (normalized.includes('center') || normalized.includes('shelter')) {
    return 'Use Center status or the map to review evacuation centers, capacity, availability, and location. Choose a center that is accepting registrations.';
  }
  if (normalized.includes('responder') || normalized.includes('acknowledge') || normalized.includes('help')) {
    return 'Responders review live incident reports, acknowledge them, and can record people or organizations involved, an ETA, and response notes. The reporter receives the update in Alerts.';
  }
  if (normalized.includes('sos') || normalized.includes('emergency')) {
    return 'Use SOS for immediate assistance and hold the button for two seconds. For immediate danger, also contact the appropriate emergency service when possible.';
  }
  return 'I can help with HANDA features, incident reporting, evacuation centers, household registration, responder updates, and disaster preparedness. Try asking about floods, fires, earthquakes, typhoons, SOS, or incident reports.';
}

export default function ChatbotWidget() {
  const { isAuthenticated } = useAuth();
  const { width, height } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: 'Hi. I am Bantay HANDA. Ask me about the app, incidents, evacuation, or disaster safety.' },
  ]);
  const panelWidth = Math.min(380, Math.max(260, width - 24));
  const panelHeight = Math.min(470, Math.max(340, height * 0.72));

  const visibleMessages = useMemo(() => messages.slice(-8), [messages]);

  if (!isAuthenticated) return null;

  const sendMessage = (text = input) => {
    const question = text.trim();
    if (!question || isTyping) return;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', text: question },
    ]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: answerQuestion(question) }]);
      setIsTyping(false);
    }, 650);
  };

  return <View pointerEvents="box-none" style={styles.layer}>
    {isOpen && <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={styles.keyboardLayer}>
      <View style={[styles.panel, { width: panelWidth, maxHeight: panelHeight }]} accessibilityViewIsModal>
        <View style={styles.panelHeader}>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="robot-outline" size={21} color={GREEN} /></View>
          <View style={styles.headerCopy}><Text style={styles.panelTitle}>Bantay HANDA</Text><Text style={styles.panelSubtitle}>Your quick safety companion</Text></View>
          <Pressable onPress={() => setIsOpen(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close HANDA Assistant"><MaterialCommunityIcons name="close" size={20} color="#526652" /></Pressable>
        </View>
        <ScrollView style={styles.messages} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {visibleMessages.map((message) => <View key={message.id} style={[styles.messageBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>{message.text}</Text></View>)}
          {isTyping && <TypingIndicator />}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPrompts} keyboardShouldPersistTaps="handled">{QUICK_PROMPTS.map((prompt) => <Pressable key={prompt} onPress={() => sendMessage(prompt)} style={styles.quickPrompt} accessibilityRole="button"><Text style={styles.quickPromptText}>{prompt}</Text></Pressable>)}</ScrollView>
        <View style={styles.inputRow}><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage()} placeholder="Ask about HANDA or disasters" placeholderTextColor="#8A9B8C" style={styles.input} returnKeyType="send" blurOnSubmit={false} /><Pressable onPress={() => sendMessage()} style={styles.sendButton} accessibilityRole="button" accessibilityLabel="Send assistant question"><MaterialCommunityIcons name="send" size={18} color="#FFFFFF" /></Pressable></View>
      </View>
    </KeyboardAvoidingView>}
    <Pressable onPress={() => setIsOpen((current) => !current)} style={[styles.floatingButton, isOpen && styles.floatingButtonOpen]} accessibilityRole="button" accessibilityLabel={isOpen ? 'Close Bantay HANDA' : 'Open Bantay HANDA'}><MaterialCommunityIcons name={isOpen ? 'close' : 'chat-processing-outline'} size={25} color="#FFFFFF" /><View style={styles.statusDot} /></Pressable>
  </View>;
}

function TypingIndicator() {
  const dotOne = useMemo(() => new Animated.Value(0.35), []);
  const dotTwo = useMemo(() => new Animated.Value(0.35), []);
  const dotThree = useMemo(() => new Animated.Value(0.35), []);

  useEffect(() => {
    const animateDot = (value: Animated.Value, delay: number) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0.35, duration: 260, useNativeDriver: true }),
      Animated.delay(260),
    ])).start();
    animateDot(dotOne, 0);
    animateDot(dotTwo, 130);
    animateDot(dotThree, 260);
    return () => {
      dotOne.stopAnimation();
      dotTwo.stopAnimation();
      dotThree.stopAnimation();
    };
  }, [dotOne, dotTwo, dotThree]);

  return <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}><Text style={styles.typingLabel}>Bantay HANDA is thinking</Text><View style={styles.typingDots}><Animated.View style={[styles.typingDot, { opacity: dotOne }]} /><Animated.View style={[styles.typingDot, { opacity: dotTwo }]} /><Animated.View style={[styles.typingDot, { opacity: dotThree }]} /></View></View>;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50 },
  keyboardLayer: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 14, paddingBottom: 96 },
  panel: { borderWidth: 1, borderColor: '#B8D5B8', borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#163A25', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 12, overflow: 'hidden' },
  panelHeader: { minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E7EFE7', backgroundColor: '#F5FAF5' },
  headerIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#DFF0DF' },
  headerCopy: { flex: 1, marginLeft: 9 },
  panelTitle: { color: '#17591D', fontSize: 14, fontWeight: '800' },
  panelSubtitle: { color: '#718171', fontSize: 10, marginTop: 2 },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  messages: { flexShrink: 1, minHeight: 150 },
  messageContent: { padding: 11, gap: 8 },
  messageBubble: { maxWidth: '88%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#F0F6F0', borderBottomLeftRadius: 2 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: GREEN, borderBottomRightRadius: 2 },
  messageText: { color: '#314A34', fontSize: 11, lineHeight: 16 },
  userMessageText: { color: '#FFFFFF' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  typingLabel: { color: '#718171', fontSize: 10, fontStyle: 'italic' },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN },
  quickPrompts: { gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
  quickPrompt: { maxWidth: 190, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: '#B8D5B8', borderRadius: 14, backgroundColor: '#FFFFFF' },
  quickPromptText: { color: GREEN, fontSize: 9, fontWeight: '700' },
  inputRow: { minHeight: 48, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: '#E7EFE7' },
  input: { flex: 1, minHeight: 34, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#D4E3D4', borderRadius: 6, color: '#263B28', fontSize: 11 },
  sendButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: GREEN },
  floatingButton: { position: 'absolute', right: 16, bottom: 92, width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: GREEN, shadowColor: '#163A25', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 10 },
  floatingButtonOpen: { backgroundColor: '#17591D' },
  statusDot: { position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderWidth: 2, borderColor: GREEN, borderRadius: 5, backgroundColor: '#F1C75B' },
});
