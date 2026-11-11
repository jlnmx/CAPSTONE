import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import AppBackArrow from '@components/AppBackArrow';
import { answerQuestion, ChatbotTurn, getLiveQuestionContext, requestModelAnswer } from '@services/chatbotAnswers';

const GREEN = '#218B25';
const QUICK_PROMPTS = ['Any typhoons right now?', 'Will it rain in Biñan today?', 'How do I report an incident?', 'How do evacuation status updates work?'];

type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string; weatherAttribution?: boolean };

function isGoogleWeatherQuestion(question: string) {
  return /weather|rain|storm|wind|flood|forecast|temperature|heat|air quality|pollution|environmental risk/i.test(question)
    && !/typhoon|tropical cyclone|cyclone/i.test(question);
}

export default function ChatbotScreen() {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: 'Hi! I am HANDA Support. Ask me anything: how to use the app, incidents, evacuation, first aid, weather, or disaster safety.' },
  ]);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async (text = input) => {
    const question = text.trim();
    if (!question || isTyping) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text: question }]);
    setInput('');
    setIsTyping(true);
    try {
      if (isGoogleWeatherQuestion(question)) {
        const answer = await answerQuestion(question);
        setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: answer, weatherAttribution: true }]);
        return;
      }

      const recentTurns: ChatbotTurn[] = [
        ...messages.slice(-9).map(({ role, text: content }) => ({ role, content })),
        { role: 'user', content: question },
      ];
      let context = '';
      try {
        context = await getLiveQuestionContext(question);
      } catch {
        context = 'Live HANDA data could not be retrieved for this question. Do not invent current conditions or incident data.';
      }
      const answer = await requestModelAnswer(recentTurns, context);
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: answer }]);
    } catch {
      let fallback: string;
      try {
        fallback = await answerQuestion(question);
      } catch {
        fallback = 'I could not retrieve the requested information right now. Please retry or check official PAGASA and local government updates.';
      }
      const hasSpecificFallback = !fallback.startsWith('I can help with current Biñan weather');
      const status = hasSpecificFallback
        ? `${fallback}\n\nHANDA Support's AI is offline right now, so this is built-in guidance.`
        : 'HANDA Support could not reach its AI service. Please check your connection and try again in a moment. For emergencies, call BCDRRMO (049) 513-9111.';
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: status, weatherAttribution: isGoogleWeatherQuestion(question) }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <AppBackArrow />
        <View style={styles.headerCopy}>
          <Text style={styles.title}>HANDA SUPPORT</Text>
          <Text style={styles.subtitle}>Your quick safety companion</Text>
        </View>
        <MaterialCommunityIcons name="robot-outline" size={34} color={Colors.white} />
      </View>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messageContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.messageText, message.role === 'user' && styles.userText]}>{message.text}</Text>
              {message.weatherAttribution && <View style={styles.attribution}>
                <Text style={styles.googleAttribution}>Google Maps</Text>
              </View>}
            </View>
          ))}
          {isTyping && <TypingIndicator />}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promptsScroll} contentContainerStyle={styles.prompts} keyboardShouldPersistTaps="handled">
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable key={prompt} onPress={() => sendMessage(prompt)} style={styles.prompt} accessibilityRole="button"><Text style={styles.promptText}>{prompt}</Text></Pressable>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage()} placeholder="Ask about weather, typhoons, or HANDA" placeholderTextColor="#8A9B8C" style={styles.input} returnKeyType="send" blurOnSubmit={false} />
          <Pressable onPress={() => sendMessage()} style={[styles.sendButton, (!input.trim() || isTyping) && styles.sendDisabled]} disabled={!input.trim() || isTyping} accessibilityRole="button" accessibilityLabel="Send assistant question"><MaterialCommunityIcons name="send" size={20} color="#FFFFFF" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TypingIndicator() {
  const dots = useMemo(() => [new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)], []);

  useEffect(() => {
    dots.forEach((value, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 130),
      Animated.timing(value, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0.35, duration: 260, useNativeDriver: true }),
      Animated.delay(260),
    ])).start());
    return () => dots.forEach((value) => value.stopAnimation());
  }, [dots]);

  return <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
    <Text style={styles.typingLabel}>HANDA Support is thinking</Text>
    <View style={styles.typingDots}>{dots.map((value, index) => <Animated.View key={index} style={[styles.typingDot, { opacity: value }]} />)}</View>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { minHeight: 80, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: GREEN, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  headerCopy: { flex: 1 },
  title: { color: Colors.white, fontSize: 24, lineHeight: 28, fontWeight: '900' },
  subtitle: { color: '#E1F1E1', fontSize: 10, marginTop: 2 },
  body: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center', backgroundColor: Colors.surface },
  messages: { flex: 1 },
  messageContent: { padding: 14, paddingTop: 18, gap: 10 },
  bubble: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceMuted, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E3ECE4' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: GREEN, borderBottomRightRadius: 4 },
  messageText: { color: Colors.text, fontSize: 13, lineHeight: 19 },
  userText: { color: '#FFFFFF' },
  attribution: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 6 },
  googleAttribution: { color: '#5E5E5E', fontSize: 12, fontWeight: '400', lineHeight: 16 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingLabel: { color: Colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  promptsScroll: { flexGrow: 0 },
  prompts: { gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  prompt: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#BFDDC0', borderRadius: 16, backgroundColor: '#F0F8F0' },
  promptText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  inputRow: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#E7EFE7', backgroundColor: Colors.surface },
  input: { flex: 1, minHeight: 44, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 22, backgroundColor: '#F7FAF7', color: Colors.text, fontSize: 13 },
  sendButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: GREEN },
  sendDisabled: { opacity: 0.45 },
});
