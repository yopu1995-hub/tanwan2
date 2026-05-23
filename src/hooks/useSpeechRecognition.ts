import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type SpeechRecognitionStatus = "idle" | "listening" | "processing";

type SpeechRecognitionCtor = new () => SpeechRecognition;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionOptions {
  /** BCP-47 language tag */
  lang?: string;
  /** Called with trimmed transcript when recognition succeeds */
  onResult: (text: string) => void;
}

export interface UseSpeechRecognitionReturn {
  status: SpeechRecognitionStatus;
  hintText: string;
  speechSupported: boolean;
  /** Object URL of last recording when browser has no speech API */
  audioUrl: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  isBusy: boolean;
}

const MIN_RECORD_MS = 1000;

export function useSpeechRecognition({
  lang = "zh-CN",
  onResult,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [speechSupported] = useState(() => getSpeechRecognitionCtor() !== null);

  const statusRef = useRef<SpeechRecognitionStatus>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const startTimeRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);
  const onResultRef = useRef(onResult);

  onResultRef.current = onResult;

  const setStatusSafe = useCallback((next: SpeechRecognitionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const revokeAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
  }, []);

  const stopMediaRecorder = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!recorder || recorder.state === "inactive") {
        cleanupStream();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        cleanupStream();
        if (chunksRef.current.length === 0) {
          resolve(null);
          return;
        }
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      try {
        recorder.stop();
      } catch {
        cleanupStream();
        resolve(null);
      }
    });
  }, [cleanupStream]);

  const abortRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const abortSession = useCallback(
    async (process: boolean) => {
      abortRecognition();
      const blob = await stopMediaRecorder();
      const duration = Date.now() - startTimeRef.current;
      chunksRef.current = [];

      if (!process || duration < MIN_RECORD_MS) {
        revokeAudioUrl();
        setStatusSafe("idle");
        return;
      }

      if (speechSupported) {
        const text = transcriptRef.current.trim();
        if (text) {
          onResultRef.current(text);
          revokeAudioUrl();
        } else {
          toast.error("未识别到语音内容");
          revokeAudioUrl();
        }
        setStatusSafe("idle");
        return;
      }

      toast.error("您的浏览器不支持语音识别，请手动输入");
      if (blob) {
        revokeAudioUrl();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
      }
      setStatusSafe("idle");
    },
    [abortRecognition, stopMediaRecorder, revokeAudioUrl, setStatusSafe, speechSupported],
  );

  const startListening = useCallback(async () => {
    if (statusRef.current !== "idle") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("当前环境不支持录音");
      return;
    }

    try {
      transcriptRef.current = "";
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();

      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let text = "";
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          transcriptRef.current = text;
        };
        recognition.onerror = (event) => {
          const code = (event as SpeechRecognitionErrorEvent).error;
          if (code === "not-allowed" || code === "service-not-allowed") {
            toast.error("请开启麦克风权限");
          } else if (code !== "aborted" && code !== "no-speech") {
            toast.error(`语音识别失败：${code}`);
          }
        };
        recognition.start();
        recognitionRef.current = recognition;
      }

      setStatusSafe("listening");
    } catch (err) {
      cleanupStream();
      abortRecognition();
      const domErr = err as DOMException;
      if (domErr.name === "NotAllowedError" || domErr.name === "PermissionDeniedError") {
        toast.error("请开启麦克风权限");
      } else {
        toast.error(domErr.message || "无法启动麦克风");
      }
      setStatusSafe("idle");
    }
  }, [lang, cleanupStream, abortRecognition, setStatusSafe]);

  const stopListening = useCallback(() => {
    if (statusRef.current !== "listening") return;
    setStatusSafe("processing");

    const recognition = recognitionRef.current;
    if (recognition) {
      recognitionRef.current = null;
      recognition.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        transcriptRef.current = text;
      };
      recognition.onend = () => {
        void abortSession(true);
      };
      recognition.onerror = () => {
        void abortSession(true);
      };
      try {
        recognition.stop();
      } catch {
        void abortSession(true);
      }
      return;
    }

    void abortSession(true);
  }, [abortSession, setStatusSafe]);

  useEffect(() => {
    return () => {
      abortRecognition();
      void stopMediaRecorder();
      revokeAudioUrl();
    };
  }, [abortRecognition, stopMediaRecorder, revokeAudioUrl]);

  const hintText =
    status === "listening" ? "正在聆听..." : status === "processing" ? "识别中..." : "";

  return {
    status,
    hintText,
    speechSupported,
    audioUrl,
    startListening,
    stopListening,
    isBusy: status !== "idle",
  };
}
