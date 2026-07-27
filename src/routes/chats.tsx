import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ban, Flag, ImagePlus, MapPin, MessageCircle, Send, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { ChatAttachmentImage } from "@/features/communication/ChatAttachmentImage";
import { ChatVoiceAttachment } from "@/features/communication/ChatVoiceAttachment";
import {
  ChatVoiceRecorder,
  type RecordedVoiceClip,
} from "@/features/communication/ChatVoiceRecorder";
import {
  CommunicationCenterHero,
  CommunicationSafetyNote,
  CommunicationSearch,
  CommunicationSignedOut,
  ConversationSummaryItem,
} from "@/features/communication/CommunicationExperience";
import { useLiveChatWorkspace } from "@/features/communication/useLiveChatWorkspace";
import {
  blockConversationParticipant,
  createMessageReport,
  fetchConversationMessages,
  fetchMyConversations,
  markConversationRead,
  removeChatAudio,
  removeChatImage,
  sendConversationMessage,
  uploadChatAudio,
  uploadChatImage,
  validateChatAudio,
  validateChatImage,
} from "@/lib/classifieds-api";
import { isPreviewRuntime, loadDiagnostics } from "@/lib/chat-audio-diagnostics";
import {
  completeMessageSendRequest,
  readOrCreateMessageSendRequestId,
} from "@/lib/api/message-send-request";
import type { ClassifiedsError, Conversation, ConversationMessage } from "@/lib/classifieds-types";
import {
  mergeConversationMessages,
  normalizeChatResourceId,
  sortAndDedupeMessages,
} from "@/lib/chat-integrity";
import { resolveConversationTarget } from "@/lib/journey-target-resolution";
import { analyzeMessageSafety } from "@/lib/message-safety";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const chatsSearchSchema = z.object({
  conversation: z.preprocess(
    (value) =>
      typeof value === "string" ? (normalizeChatResourceId(value) ?? undefined) : undefined,
    z.string().optional(),
  ),
});

const quickReplies = [
  { ar: "هل الإعلان ما زال متوفراً؟", en: "Is this listing still available?" },
  { ar: "ما السعر النهائي؟", en: "What is your final price?" },
  { ar: "هل يمكن المعاينة قبل الشراء؟", en: "Can I inspect it before buying?" },
  { ar: "متى يناسبك التواصل؟", en: "When is a good time to talk?" },
] as const;
const EMPTY_CONVERSATIONS: Conversation[] = [];
const EMPTY_MESSAGES: ConversationMessage[] = [];

export const Route = createFileRoute("/chats")({
  validateSearch: chatsSearchSchema,
  head: () => ({
    meta: [{ title: "المحادثات | رواجا" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ChatsPage,
});

function ChatsPage() {
  const auth = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationError, setConversationError] = useState<ClassifiedsError | null>(null);
  const [messageError, setMessageError] = useState<ClassifiedsError | null>(null);
  const [composerDrafts, setComposerDrafts] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState<{
    scopeKey: string;
    file: File;
    previewUrl: string;
  } | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<
    (RecordedVoiceClip & { scopeKey: string }) | null
  >(null);
  const [locating, setLocating] = useState(false);
  const [conversationQuery, setConversationQuery] = useState("");
  const [sendingScopes, setSendingScopes] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const [confirmedRisk, setConfirmedRisk] = useState<{
    scopeKey: string;
    body: string;
  } | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [viewingConversationOnMobile, setViewingConversationOnMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const messagesRequestIdRef = useRef(0);
  const conversationsRequestIdRef = useRef(0);
  const selectedConversationIdRef = useRef<string | null>(null);
  const profileIdRef = useRef<string | null>(auth.profile?.id ?? null);
  const accountGenerationRef = useRef(0);
  const autoOpenedConversationRef = useRef<string | null>(null);
  const sendInFlightScopesRef = useRef<Set<string>>(new Set());
  const reportInFlightRef = useRef<Set<string>>(new Set());
  const blockInFlightRef = useRef<Set<string>>(new Set());
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const liveProfileId = auth.profile?.id ?? null;
  const accountStateMatches = profileIdRef.current === liveProfileId;
  const accountConversations = accountStateMatches ? conversations : EMPTY_CONVERSATIONS;
  const accountMessages = accountStateMatches ? messages : EMPTY_MESSAGES;

  const targetResolution = useMemo(
    () => resolveConversationTarget(accountConversations, search.conversation),
    [accountConversations, search.conversation],
  );
  const selectedConversation =
    targetResolution.kind === "selected" || targetResolution.kind === "default"
      ? targetResolution.conversation
      : null;
  const missingConversationTarget = targetResolution.kind === "missing";
  const composerScopeKey =
    auth.profile?.id && selectedConversation?.id
      ? [auth.profile.id, selectedConversation.id].join(":")
      : null;
  const body = composerScopeKey ? (composerDrafts[composerScopeKey] ?? "") : "";
  const sending = composerScopeKey ? sendingScopes.has(composerScopeKey) : false;
  const currentImage =
    composerScopeKey && selectedImage?.scopeKey === composerScopeKey ? selectedImage : null;
  const currentVoice =
    composerScopeKey && selectedVoice?.scopeKey === composerScopeKey ? selectedVoice : null;
  const messageSafety = useMemo(() => analyzeMessageSafety(body), [body]);
  const visibleMessages = useMemo(
    () =>
      selectedConversation ? sortAndDedupeMessages(accountMessages, selectedConversation.id) : [],
    [accountMessages, selectedConversation],
  );
  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLocaleLowerCase(language === "ar" ? "ar" : "en");
    if (!query) return accountConversations;
    return accountConversations.filter((conversation) =>
      [
        conversation.otherParticipant.displayName,
        conversation.listingTitle,
        conversation.lastMessagePreview ?? "",
      ].some((value) => value.toLocaleLowerCase(language === "ar" ? "ar" : "en").includes(query)),
    );
  }, [accountConversations, conversationQuery, language]);

  const isConversationPanelVisible = isDesktop || viewingConversationOnMobile;
  const liveConversationId =
    selectedConversation && isConversationPanelVisible ? selectedConversation.id : null;

  useLiveChatWorkspace({
    signedIn: auth.status === "signedIn",
    profileId: auth.profile?.id ?? null,
    selectedConversationId: liveConversationId,
    setConversations,
    setMessages,
  });

  useEffect(() => {
    const nextProfileId = auth.profile?.id ?? null;
    const previousProfileId = profileIdRef.current;
    profileIdRef.current = nextProfileId;
    if (previousProfileId === nextProfileId) return;
    accountGenerationRef.current += 1;

    setComposerDrafts({});
    setSelectedImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setSelectedVoice((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setConversationQuery("");
    setSendingScopes(new Set());
    setConfirmedRisk(null);
    setReportingMessageId(null);
    setBlockReason("");
    setBlocking(false);
    setNotice("");
    sendInFlightScopesRef.current.clear();
    reportInFlightRef.current.clear();
    blockInFlightRef.current.clear();
    conversationsRequestIdRef.current += 1;
    messagesRequestIdRef.current += 1;
    setConversations([]);
    setMessages([]);
    setConversationError(null);
    setMessageError(null);
    setLoadingConversations(false);
    setLoadingMessages(false);
    setViewingConversationOnMobile(false);
    if (search.conversation) {
      void navigate({ to: "/chats", search: {}, replace: true });
    }
  }, [auth.profile?.id, navigate, search.conversation]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null;
    setConfirmedRisk(null);
    setBlockReason("");
    setBlocking(false);
    setNotice("");
    setMessageError(null);
    setReportingMessageId(null);
    setSelectedImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setSelectedVoice((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation && !missingConversationTarget) {
      setViewingConversationOnMobile(false);
    }
  }, [missingConversationTarget, selectedConversation]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    autoOpenedConversationRef.current = null;
  }, [search.conversation]);

  useEffect(() => {
    if (!isDesktop && search.conversation && accountConversations.length > 0) {
      const exists = accountConversations.some(
        (conversation) => conversation.id === search.conversation,
      );
      if (exists && autoOpenedConversationRef.current !== search.conversation) {
        autoOpenedConversationRef.current = search.conversation;
        setViewingConversationOnMobile(true);
      }
    }
  }, [accountConversations, isDesktop, search.conversation]);

  async function loadConversations() {
    const profileId = auth.profile?.id ?? null;
    if (!profileId) return;
    const requestId = ++conversationsRequestIdRef.current;
    setLoadingConversations(true);
    setConversationError(null);
    try {
      const result = await fetchMyConversations();
      if (requestId !== conversationsRequestIdRef.current || profileId !== profileIdRef.current) {
        return;
      }
      if (result.ok) {
        setConversations(result.data);
      } else {
        setConversationError(result.error);
      }
    } catch (caught) {
      if (requestId !== conversationsRequestIdRef.current || profileId !== profileIdRef.current) {
        return;
      }
      setConversationError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل المحادثات.", "Could not load conversations."),
        operation: "chat_conversations_load",
      });
    } finally {
      if (requestId === conversationsRequestIdRef.current && profileId === profileIdRef.current) {
        setLoadingConversations(false);
      }
    }
  }

  async function loadMessages(conversationId: string) {
    const profileId = auth.profile?.id ?? null;
    if (!profileId) return;
    const requestId = ++messagesRequestIdRef.current;
    setLoadingMessages(true);
    setMessageError(null);
    try {
      const result = await fetchConversationMessages(conversationId);
      if (
        requestId !== messagesRequestIdRef.current ||
        profileId !== profileIdRef.current ||
        conversationId !== selectedConversationIdRef.current
      ) {
        return;
      }
      if (!result.ok) {
        setMessageError(result.error);
        return;
      }
      setMessages(sortAndDedupeMessages(result.data, conversationId));
      const markResult = await markConversationRead(conversationId);
      if (
        requestId !== messagesRequestIdRef.current ||
        profileId !== profileIdRef.current ||
        conversationId !== selectedConversationIdRef.current
      ) {
        return;
      }
      if (!markResult.ok) setNotice(markResult.error.message);
    } catch (caught) {
      if (
        requestId !== messagesRequestIdRef.current ||
        profileId !== profileIdRef.current ||
        conversationId !== selectedConversationIdRef.current
      ) {
        return;
      }
      setMessageError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل الرسائل.", "Could not load messages."),
        operation: "chat_messages_load",
      });
    } finally {
      if (
        requestId === messagesRequestIdRef.current &&
        profileId === profileIdRef.current &&
        conversationId === selectedConversationIdRef.current
      ) {
        setLoadingMessages(false);
      }
    }
  }

  useEffect(() => {
    if (auth.status !== "signedIn") {
      conversationsRequestIdRef.current += 1;
      messagesRequestIdRef.current += 1;
      setConversations([]);
      setMessages([]);
      setLoadingConversations(false);
      setLoadingMessages(false);
      return;
    }
    void loadConversations();
  }, [auth.status, auth.profile?.id]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !selectedConversation || !isConversationPanelVisible) {
      messagesRequestIdRef.current += 1;
      setMessages([]);
      setMessageError(null);
      setLoadingMessages(false);
      return;
    }
    void loadMessages(selectedConversation.id);
  }, [auth.status, isConversationPanelVisible, selectedConversation?.id]);

  function updateComposerDraft(scopeKey: string, value: string) {
    setComposerDrafts((current) => {
      if (value.length === 0) {
        if (!(scopeKey in current)) return current;
        const next = { ...current };
        delete next[scopeKey];
        return next;
      }
      if (current[scopeKey] === value) return current;
      return { ...current, [scopeKey]: value };
    });
  }

  function clearComposerDraftIfUnchanged(scopeKey: string, submittedBody: string) {
    setComposerDrafts((current) => {
      if ((current[scopeKey] ?? "").trim() !== submittedBody) return current;
      const next = { ...current };
      delete next[scopeKey];
      return next;
    });
  }

  function setCurrentComposerBody(value: string) {
    if (!composerScopeKey) return;
    updateComposerDraft(composerScopeKey, value);
    setConfirmedRisk(null);
  }

  function clearSelectedImage() {
    setSelectedImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function clearSelectedVoice() {
    setSelectedVoice((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  function handleVoiceRecorded(clip: RecordedVoiceClip) {
    if (!composerScopeKey) return;
    const validation = validateChatAudio(clip.file, clip.durationMs);
    if (!validation.ok) {
      URL.revokeObjectURL(clip.previewUrl);
      setMessageError(validation.error);
      return;
    }
    clearSelectedImage();
    setMessageError(null);
    setSelectedVoice((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { ...clip, scopeKey: composerScopeKey };
    });
  }

  function shareCurrentLocation() {
    if (!composerScopeKey || locating || !navigator.geolocation) {
      setNotice(
        text("تعذر الوصول إلى الموقع على هذا الجهاز.", "Location is unavailable on this device."),
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = coords.latitude.toFixed(5);
        const longitude = coords.longitude.toFixed(5);
        setCurrentComposerBody(
          text(
            "موقعي الحالي: https://www.google.com/maps?q=" + latitude + "," + longitude,
            "My current location: https://www.google.com/maps?q=" + latitude + "," + longitude,
          ),
        );
        setLocating(false);
      },
      () => {
        setNotice(
          text(
            "لم نتمكن من تحديد موقعك. تحقق من الإذن ثم حاول مجددًا.",
            "We could not access your location. Check permission and try again.",
          ),
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  function handleImageSelection(file: File | null) {
    if (!composerScopeKey || !file) return;
    const validation = validateChatImage(file);
    if (!validation.ok) {
      setMessageError(validation.error);
      return;
    }
    clearSelectedVoice();
    setMessageError(null);
    setSelectedImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { scopeKey: composerScopeKey, file, previewUrl: URL.createObjectURL(file) };
    });
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profileId = auth.profile?.id ?? null;
    const conversationId = selectedConversation?.id ?? null;
    const scopeKey = composerScopeKey;
    const accountGeneration = accountGenerationRef.current;
    if (
      !profileId ||
      !selectedConversation ||
      !conversationId ||
      !scopeKey ||
      sendInFlightScopesRef.current.has(scopeKey)
    )
      return;
    if (selectedConversation.status !== "active") {
      setNotice(
        text(
          "هذه المحادثة محفوظة كسجل ولا تقبل رسائل جديدة.",
          "This conversation is preserved as history and cannot receive new messages.",
        ),
      );
      return;
    }
    const cleanBody = body.trim();
    const image = currentImage;
    const voice = currentVoice;
    if (!cleanBody && !image && !voice) return;
    const safety = analyzeMessageSafety(cleanBody);
    if (
      safety.requiresConfirmation &&
      (confirmedRisk?.scopeKey !== scopeKey || confirmedRisk.body !== cleanBody)
    ) {
      setConfirmedRisk({ scopeKey, body: cleanBody });
      setNotice(
        text(
          "تتضمن الرسالة طلب دفع أو بيانات حساسة. راجع التحذير ثم اضغط إرسال مرة ثانية للتأكيد.",
          "This message mentions payment or sensitive credentials. Review the warning, then press send again to confirm.",
        ),
      );
      return;
    }
    const requestSignature = image
      ? `${cleanBody}\n[image:${image.file.name}:${image.file.size}:${image.file.lastModified}]`
      : voice
        ? `${cleanBody}\n[audio:${voice.file.name}:${voice.file.size}:${voice.durationMs}]`
        : cleanBody;
    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, requestSignature);
    sendInFlightScopesRef.current.add(scopeKey);
    setSendingScopes((current) => new Set(current).add(scopeKey));
    setNotice("");
    setMessageError(null);
    let uploadedPath: string | null = null;
    try {
      const uploadResult = image
        ? await uploadChatImage({ conversationId, requestId, file: image.file })
        : voice
          ? await uploadChatAudio({
              conversationId,
              requestId,
              file: voice.file,
              durationMs: voice.durationMs,
            })
          : null;
      if (uploadResult && !uploadResult.ok) {
        if (accountGenerationRef.current === accountGeneration) setMessageError(uploadResult.error);
        return;
      }
      uploadedPath = uploadResult?.data.path ?? null;
      const result = await sendConversationMessage({
        conversationId,
        body: cleanBody,
        requestId,
        attachment: uploadResult?.data ?? null,
      });
      const stillCurrent =
        accountGenerationRef.current === accountGeneration &&
        profileIdRef.current === profileId &&
        selectedConversationIdRef.current === conversationId;
      if (!result.ok) {
        if (uploadedPath) {
          if (voice) await removeChatAudio(uploadedPath);
          else await removeChatImage(uploadedPath);
        }
        if (stillCurrent) setMessageError(result.error);
        return;
      }
      completeMessageSendRequest(profileId, conversationId, requestId);
      if (stillCurrent) {
        clearComposerDraftIfUnchanged(scopeKey, cleanBody);
        clearSelectedImage();
        clearSelectedVoice();
        setConfirmedRisk((current) => (current?.scopeKey === scopeKey ? null : current));
        setMessages((current) => mergeConversationMessages(current, [result.data], conversationId));
        setNotice(text("تم إرسال الرسالة.", "Message sent."));
      }
      if (profileIdRef.current === profileId) await loadConversations();
    } catch (caught) {
      if (uploadedPath) {
        try {
          if (voice) await removeChatAudio(uploadedPath);
          else await removeChatImage(uploadedPath);
        } catch {
          // Best-effort cleanup; the user-facing send failure remains primary.
        }
      }
      if (
        accountGenerationRef.current === accountGeneration &&
        profileIdRef.current === profileId &&
        selectedConversationIdRef.current === conversationId
      ) {
        setMessageError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر إرسال الرسالة.", "Could not send the message."),
          operation: "chat_message_send",
        });
      }
    } finally {
      if (accountGenerationRef.current === accountGeneration) {
        sendInFlightScopesRef.current.delete(scopeKey);
        setSendingScopes((current) => {
          const next = new Set(current);
          next.delete(scopeKey);
          return next;
        });
      }
    }
  }

  async function handleReport(message: ConversationMessage) {
    const profileId = auth.profile?.id ?? null;
    const conversationId = selectedConversation?.id ?? null;
    const accountGeneration = accountGenerationRef.current;
    const reportScope = [profileId, conversationId, message.id].join(":");
    if (!profileId || !conversationId || reportInFlightRef.current.has(reportScope)) return;
    reportInFlightRef.current.add(reportScope);
    setReportingMessageId(message.id);
    setNotice("");
    try {
      const result = await createMessageReport({
        messageId: message.id,
        reason: "abusive_or_suspicious",
      });
      if (
        profileIdRef.current !== profileId ||
        accountGenerationRef.current !== accountGeneration ||
        selectedConversationIdRef.current !== conversationId
      )
        return;
      setNotice(
        result.ok
          ? text("تم إرسال بلاغ الرسالة للمراجعة.", "Message report sent for review.")
          : result.error.message,
      );
    } catch (caught) {
      if (
        profileIdRef.current === profileId &&
        accountGenerationRef.current === accountGeneration &&
        selectedConversationIdRef.current === conversationId
      ) {
        setNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر إرسال بلاغ الرسالة.", "Could not report the message."),
        );
      }
    } finally {
      if (accountGenerationRef.current === accountGeneration) {
        reportInFlightRef.current.delete(reportScope);
        if (
          profileIdRef.current === profileId &&
          selectedConversationIdRef.current === conversationId
        ) {
          setReportingMessageId((current) => (current === message.id ? null : current));
        }
      }
    }
  }

  async function handleBlock() {
    const profileId = auth.profile?.id ?? null;
    const conversationId = selectedConversation?.id ?? null;
    const accountGeneration = accountGenerationRef.current;
    const reason = blockReason || null;
    const blockScope = [profileId, conversationId].join(":");
    if (!profileId || !conversationId || blockInFlightRef.current.has(blockScope)) return;
    if (
      !confirm(text("حظر هذا المستخدم في هذه المحادثة؟", "Block this user in this conversation?"))
    )
      return;
    blockInFlightRef.current.add(blockScope);
    setBlocking(true);
    setNotice("");
    try {
      const result = await blockConversationParticipant({
        conversationId,
        reason,
      });
      const stillCurrent =
        accountGenerationRef.current === accountGeneration &&
        profileIdRef.current === profileId &&
        selectedConversationIdRef.current === conversationId;
      if (stillCurrent) {
        setNotice(
          result.ok
            ? text(
                "تم حظر المحادثة. لن تقبل رسائل جديدة.",
                "Conversation blocked. New messages are no longer allowed.",
              )
            : result.error.message,
        );
      }
      if (result.ok && profileIdRef.current === profileId) await loadConversations();
    } catch (caught) {
      if (
        accountGenerationRef.current === accountGeneration &&
        profileIdRef.current === profileId &&
        selectedConversationIdRef.current === conversationId
      ) {
        setNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر حظر المحادثة.", "Could not block the conversation."),
        );
      }
    } finally {
      if (accountGenerationRef.current === accountGeneration) {
        blockInFlightRef.current.delete(blockScope);
        setBlocking(false);
      }
    }
  }

  function openFirstAvailableConversation() {
    const firstConversation = accountConversations[0];
    if (firstConversation) {
      if (!isDesktop) setViewingConversationOnMobile(true);
      void navigate({
        to: "/chats",
        search: { conversation: firstConversation.id },
        replace: true,
      });
      return;
    }
    void navigate({ to: "/chats", search: {}, replace: true });
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("المحادثات", "Messages")} titleIsPageHeading={false} />
        <main className="rawaj-communication-v2 container-wide mobile-page-bottom pt-4">
          <CommunicationSignedOut returnTo="/chats" />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("المحادثات", "Messages")} titleIsPageHeading={false} />
      <main className="rawaj-communication-v2 rawaj-communication-v2--messages rawaj-messaging-v4 container-wide mobile-page-bottom space-y-4 pt-4">
        <div className="hidden lg:block">
          <CommunicationCenterHero
            mode="messages"
            unreadMessages={accountConversations.reduce(
              (total, conversation) => total + conversation.unreadCount,
              0,
            )}
            conversationCount={accountConversations.length}
          />
        </div>
        <div className="hidden lg:block">
          <CommunicationSafetyNote />
        </div>

        <div
          className="rawaj-message-workspace"
          data-view={selectedConversation ? "conversation" : "list"}
        >
          <aside
            className={`rawaj-conversation-sidebar ${
              !isDesktop && viewingConversationOnMobile ? "hidden" : ""
            }`}
          >
            <div className="rawaj-conversation-sidebar__heading">
              <h2>
                <MessageCircle aria-hidden="true" />
                {text("المحادثات", "Conversations")}
              </h2>
              <span>{filteredConversations.length}</span>
            </div>
            <CommunicationSearch
              value={conversationQuery}
              onChange={setConversationQuery}
              placeholder={text("ابحث باسم أو إعلان أو رسالة", "Search conversations")}
              label={text("بحث في المحادثات", "Search conversations")}
            />
            {!accountStateMatches || loadingConversations ? (
              <PanelText>{text("جاري تحميل المحادثات.", "Loading conversations.")}</PanelText>
            ) : conversationError ? (
              <PanelText role="alert">{conversationError.message}</PanelText>
            ) : accountConversations.length === 0 ? (
              <PanelText>
                {text(
                  "لا توجد محادثات بعد. افتح إعلانا معتمدا وابدأ محادثة من صفحة الإعلان.",
                  "No conversations yet. Open an approved listing and start a conversation from it.",
                )}
              </PanelText>
            ) : filteredConversations.length === 0 ? (
              <PanelText>
                {text("لا توجد محادثات تطابق بحثك.", "No conversations match your search.")}
              </PanelText>
            ) : (
              <div className="rawaj-conversation-list">
                {filteredConversations.map((conversation) => (
                  <ConversationSummaryItem
                    key={conversation.id}
                    conversation={conversation}
                    selected={selectedConversation?.id === conversation.id}
                    dateLabel={
                      conversation.lastMessageAt
                        ? formatConversationTime(conversation.lastMessageAt, language)
                        : ""
                    }
                    onSelect={() => {
                      if (!isDesktop) setViewingConversationOnMobile(true);
                      void navigate({
                        to: "/chats",
                        search: { conversation: conversation.id },
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </aside>

          <section
            className={`rawaj-message-panel ${
              !isDesktop && !viewingConversationOnMobile && !missingConversationTarget
                ? "hidden"
                : ""
            }`}
          >
            {missingConversationTarget ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div className="max-w-md">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-warning/10 text-warning">
                    <MessageCircle className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 text-base font-extrabold">
                    {text("المحادثة غير متاحة", "Conversation unavailable")}
                  </h2>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {text(
                      "الرابط المطلوب لا يشير إلى محادثة متاحة في حسابك. لم نفتح أي محادثة أخرى بدلًا منها.",
                      "The requested link does not point to an available conversation in your account. No other conversation was opened instead.",
                    )}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {accountConversations.length > 0 && (
                      <button
                        type="button"
                        onClick={openFirstAvailableConversation}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                      >
                        {text("فتح محادثة متاحة", "Open an available conversation")}
                      </button>
                    )}
                    <Link
                      to="/listings"
                      className="rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold text-foreground hairline"
                    >
                      {text("تصفح الإعلانات", "Browse listings")}
                    </Link>
                  </div>
                </div>
              </div>
            ) : !selectedConversation ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <PanelText>{text("اختر محادثة لعرض الرسائل.", "Choose a conversation.")}</PanelText>
              </div>
            ) : (
              <>
                <header className="rawaj-message-header">
                  <div className="rawaj-message-header__row">
                    {!isDesktop && viewingConversationOnMobile && (
                      <button
                        type="button"
                        onClick={() => setViewingConversationOnMobile(false)}
                        className="inline-flex items-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
                        aria-label={text("المحادثات", "Conversations")}
                      >
                        ← {text("المحادثات", "Conversations")}
                      </button>
                    )}
                    <Avatar
                      name={selectedConversation.otherParticipant.displayName}
                      url={selectedConversation.otherParticipant.avatarUrl}
                    />
                    <div className="rawaj-message-header__copy">
                      <h2 className="truncate text-sm font-extrabold">
                        {selectedConversation.otherParticipant.displayName}
                      </h2>
                      {selectedConversation.listingId ? (
                        <Link
                          to="/listings/$id"
                          params={{ id: selectedConversation.listingId }}
                          className="truncate text-xs font-semibold text-primary"
                        >
                          {selectedConversation.listingTitle}
                        </Link>
                      ) : (
                        <span className="block truncate text-xs font-semibold text-muted-foreground">
                          {selectedConversation.listingTitle} ·{" "}
                          {text("إعلان محذوف", "Deleted listing")}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleBlock()}
                      disabled={blocking}
                      aria-busy={blocking}
                      aria-label={text("حظر المستخدم", "Block user")}
                      className="inline-flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-bold text-destructive"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {blocking ? text("جارٍ الحظر", "Blocking") : text("حظر", "Block")}
                    </button>
                  </div>
                  {selectedConversation.status === "archived" && (
                    <p className="mt-3 rounded-xl bg-warning/10 p-2 text-xs font-semibold text-warning">
                      {text(
                        "تم حذف الإعلان. احتفظنا بالمحادثة كسجل ولا يمكن إرسال رسائل جديدة.",
                        "The listing was deleted. This conversation is preserved as history and cannot receive new messages.",
                      )}
                    </p>
                  )}
                  {selectedConversation.status === "blocked" && (
                    <p className="mt-3 rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">
                      {text(
                        "هذه المحادثة محظورة ولا تقبل رسائل جديدة.",
                        "This conversation is blocked and cannot receive new messages.",
                      )}
                    </p>
                  )}
                </header>

                <div className="rawaj-message-stream">
                  {loadingMessages ? (
                    <PanelText>{text("جاري تحميل الرسائل.", "Loading messages.")}</PanelText>
                  ) : messageError ? (
                    <PanelText role="alert">{messageError.message}</PanelText>
                  ) : visibleMessages.length === 0 ? (
                    <PanelText>
                      {text(
                        "لا توجد رسائل بعد. اكتب أول رسالة حقيقية لهذه المحادثة.",
                        "No messages yet. Write the first real message in this conversation.",
                      )}
                    </PanelText>
                  ) : (
                    visibleMessages.map((message) => {
                      const mine = message.isMine;
                      return (
                        <article key={message.id} className="rawaj-message-bubble" data-mine={mine}>
                          {message.attachmentPath && message.attachmentKind === "audio" ? (
                            <ChatVoiceAttachment
                              attachmentPath={message.attachmentPath}
                              initialUrl={message.attachmentUrl}
                              durationMs={message.attachmentDurationMs}
                              retryLabel={text("إعادة تحميل التسجيل", "Reload voice message")}
                              unavailableLabel={text(
                                "تعذر تشغيل التسجيل الصوتي. أعد تحميله أو حاول مرة أخرى.",
                                "Could not play the voice message. Reload it or try again.",
                              )}
                            />
                          ) : message.attachmentPath ? (
                            <ChatAttachmentImage
                              attachmentPath={message.attachmentPath}
                              initialUrl={message.attachmentUrl}
                              alt={text("صورة مرفقة بالمحادثة", "Chat attachment")}
                              retryLabel={text("إعادة تحميل الصورة", "Reload image")}
                              unavailableLabel={text(
                                "تعذر تحميل الصورة الخاصة. حاول مجددًا.",
                                "The private image could not be loaded. Try again.",
                              )}
                            />
                          ) : null}
                          {message.body && (
                            <p className="whitespace-pre-line break-words">{message.body}</p>
                          )}
                          <p className="rawaj-message-bubble__time">
                            {formatDateTime(message.createdAt, language)}
                            {mine ? (
                              <span
                                className="ms-1 font-bold"
                                data-message-state={
                                  selectedConversation.otherLastReadAt &&
                                  Date.parse(selectedConversation.otherLastReadAt) >=
                                    Date.parse(message.createdAt)
                                    ? "read"
                                    : "delivered"
                                }
                              >
                                {" · "}
                                {selectedConversation.otherLastReadAt &&
                                Date.parse(selectedConversation.otherLastReadAt) >=
                                  Date.parse(message.createdAt)
                                  ? text("مقروءة", "Read")
                                  : text("تم التسليم", "Delivered")}
                              </span>
                            ) : null}
                          </p>
                          {!mine && (
                            <button
                              type="button"
                              disabled={reportingMessageId === message.id}
                              onClick={() => void handleReport(message)}
                              aria-label={text("إبلاغ عن هذه الرسالة", "Report this message")}
                              className="rawaj-message-bubble__report"
                            >
                              <Flag className="h-3 w-3" />
                              {reportingMessageId === message.id
                                ? text("جارٍ الإبلاغ", "Reporting")
                                : text("إبلاغ", "Report")}
                            </button>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>

                <form
                  onSubmit={(event) => void handleSend(event)}
                  aria-busy={sending}
                  className="rawaj-message-composer"
                >
                  <input
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                    disabled={blocking}
                    maxLength={300}
                    placeholder={text("سبب الحظر اختياري", "Optional block reason")}
                    className="rawaj-message-composer__block-reason mb-2"
                  />
                  {selectedConversation.status === "active" ? (
                    <div className="mb-2">
                      <p className="mb-1.5 text-[10px] font-bold text-muted-foreground">
                        {text("ردود سريعة", "Quick replies")}
                      </p>
                      <div className="rawaj-quick-replies">
                        {quickReplies.map((reply) => (
                          <button
                            key={reply.en}
                            type="button"
                            onClick={() => {
                              setCurrentComposerBody(language === "ar" ? reply.ar : reply.en);
                            }}
                          >
                            {language === "ar" ? reply.ar : reply.en}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {messageSafety.level !== "safe" ? (
                    <aside
                      className={[
                        "mb-2 flex items-start gap-2 rounded-xl border p-3 text-xs leading-5",
                        messageSafety.level === "danger"
                          ? "border-destructive/25 bg-destructive/10 text-destructive"
                          : "border-warning/25 bg-warning/10 text-foreground",
                      ].join(" ")}
                      role="status"
                    >
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div>
                        <strong>
                          {messageSafety.level === "danger"
                            ? text("راجع الرسالة قبل الإرسال", "Review before sending")
                            : text(
                                "انتبه للرابط أو التواصل الخارجي",
                                "Check links and off-platform contact",
                              )}
                        </strong>
                        <p>
                          {messageSafety.level === "danger"
                            ? text(
                                "لا تشارك كلمة مرور أو رمز تحقق، ولا تحول مبلغاً قبل المعاينة والتحقق من الطرف الآخر.",
                                "Never share passwords or verification codes, and do not transfer money before inspection and verification.",
                              )
                            : text(
                                "افتح الروابط بحذر واحتفظ بتفاصيل الاتفاق داخل رواج قدر الإمكان.",
                                "Open links carefully and keep agreement details inside RAWAJ whenever possible.",
                              )}
                        </p>
                      </div>
                    </aside>
                  ) : null}
                  {currentImage && (
                    <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted-surface p-2 hairline">
                      <img
                        src={currentImage.previewUrl}
                        alt={text("معاينة الصورة", "Image preview")}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{currentImage.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(currentImage.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedImage}
                        className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive"
                        aria-label={text("إزالة الصورة", "Remove image")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {currentVoice && (
                    <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted-surface p-2 hairline">
                      <audio controls src={currentVoice.previewUrl} className="min-w-0 flex-1" />
                      <button
                        type="button"
                        onClick={clearSelectedVoice}
                        className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive"
                        aria-label={text("إزالة التسجيل", "Remove voice message")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-[auto_auto_auto_1fr_auto]">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => handleImageSelection(event.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      disabled={sending || selectedConversation.status !== "active"}
                      onClick={() => imageInputRef.current?.click()}
                      className="grid min-h-12 place-items-center rounded-xl bg-muted-surface px-4 text-primary hairline"
                      aria-label={text("إرفاق صورة", "Attach image")}
                    >
                      <ImagePlus className="h-5 w-5" />
                    </button>
                    <ChatVoiceRecorder
                      disabled={
                        sending || selectedConversation.status !== "active" || Boolean(currentImage)
                      }
                      onRecorded={handleVoiceRecorded}
                      onError={(message) => setNotice(message)}
                      labels={{
                        start: text("تسجيل رسالة صوتية", "Record voice message"),
                        stop: text("إيقاف التسجيل", "Stop recording"),
                        cancel: text("إلغاء التسجيل", "Cancel recording"),
                        permission: text(
                          "تعذر الوصول إلى الميكروفون. تحقق من إذن Safari ثم حاول مجددًا.",
                          "Microphone access failed. Check Safari permission and try again.",
                        ),
                        unsupported: text(
                          "التسجيل الصوتي غير مدعوم على هذا الجهاز.",
                          "Voice recording is unsupported on this device.",
                        ),
                        noAudio: text(
                          "لم يتم التقاط صوت. أعد التسجيل لمدة أطول.",
                          "No audio was captured. Record longer.",
                        ),
                      }}
                    />
                    <button
                      type="button"
                      disabled={sending || locating || selectedConversation.status !== "active"}
                      onClick={shareCurrentLocation}
                      className="grid min-h-12 place-items-center rounded-xl bg-muted-surface px-4 text-primary hairline"
                      aria-label={text("مشاركة الموقع", "Share location")}
                    >
                      <MapPin className="h-5 w-5" />
                    </button>
                    <textarea
                      value={body}
                      onChange={(event) => {
                        setCurrentComposerBody(event.target.value);
                      }}
                      maxLength={2000}
                      rows={2}
                      placeholder={text("اكتب رسالة...", "Write a message...")}
                      aria-label={text("اكتب رسالة...", "Write a message...")}
                    />
                    <button
                      type="submit"
                      disabled={
                        sending ||
                        (body.trim().length === 0 && !currentImage && !currentVoice) ||
                        selectedConversation.status !== "active"
                      }
                      className="rawaj-message-composer__send"
                    >
                      <Send className="h-4 w-4" />
                      {sending
                        ? text("جاري الإرسال", "Sending")
                        : messageSafety.requiresConfirmation &&
                            confirmedRisk?.scopeKey === composerScopeKey &&
                            confirmedRisk.body === body.trim()
                          ? text("تأكيد وإرسال", "Confirm and send")
                          : text("إرسال", "Send")}
                    </button>
                  </div>
                  {notice && (
                    <p className="mt-2 text-xs font-semibold text-emerald-trust">{notice}</p>
                  )}
                  {isPreviewRuntime() && <VoiceDiagnosticsPreview />}
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-card text-sm font-bold text-primary hairline">
      {url ? (
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}

function PanelText({
  children,
  role = "status",
}: {
  children: React.ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <p
      role={role}
      className="rounded-xl bg-muted-surface p-3 text-xs leading-6 text-muted-foreground"
    >
      {children}
    </p>
  );
}

function formatDateTime(value: string, language: "ar" | "en") {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatConversationTime(value: string, language: "ar" | "en") {
  const date = new Date(value);
  const now = new Date();
  const isToday =
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate();

  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    ...(isToday ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

function VoiceDiagnosticsPreview() {
  const { text } = useUiPreferences();
  const [diagnostics, setDiagnostics] = useState<ReturnType<typeof loadDiagnostics>>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDiagnostics(loadDiagnostics());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!diagnostics) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
      <p className="font-semibold text-destructive">
        {text("رمز تشخيص التسجيل:", "Recording diagnostic code:")} {diagnostics.stage}
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-2 rounded-lg bg-muted-surface px-3 py-1 text-xs font-semibold text-primary hairline"
      >
        {copied ? text("تم النسخ", "Copied") : text("نسخ تفاصيل العطل", "Copy failure details")}
      </button>
    </div>
  );
}
