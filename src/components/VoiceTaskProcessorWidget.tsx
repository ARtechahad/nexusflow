import React, { useState, useRef } from 'react';
import { Mic, Square, Sparkles, CheckCircle2, ListTodo, Volume2, RefreshCw, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const VoiceTaskProcessorWidget: React.FC = () => {
  const { currentTenant, authToken, showToast, refreshProjects } = useApp();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [audioResult, setAudioResult] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      showToast('Microphone access prohibited or unavailable. Loading simulation mode.', 'info');
      simulateVoiceProcessing();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const processAudioBlob = async (blob: Blob) => {
    setProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const res = await fetch('/api/ai/transcribe-voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': currentTenant?.id || 'tenant-alm-nexus',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({
            base64Audio,
            mimeType: 'audio/webm',
            createTasksInKanban: true
          })
        });

        const json = await res.json();
        if (json.success && json.data) {
          setAudioResult(json.data);
          await refreshProjects();
          showToast(`🎉 Processed voice note & auto-created ${json.data.createdTaskCount || 2} PM Kanban tasks!`);
        } else {
          showToast('Error processing voice audio.', 'error');
        }
        setProcessing(false);
      };
    } catch (err: any) {
      showToast('Error reading audio data: ' + err.message, 'error');
      setProcessing(false);
    }
  };

  const simulateVoiceProcessing = async () => {
    setProcessing(true);
    setTimeout(async () => {
      const mockResult = {
        transcript: 'Client confirmed the $250 50% advance milestone deposit. Requested mobile viewport check and staging link by COB.',
        summary: 'Milestone payment confirmed & mobile QA turnaround requested.',
        actionItems: [
          'Verify $250 50% advance in Stripe/Payoneer ledger',
          'Execute mobile viewport QA audit on staging environment',
          'Dispatch staging preview link to client'
        ],
        createdTaskCount: 3
      };
      setAudioResult(mockResult);
      await refreshProjects();
      showToast('🎉 Simulation: Auto-created 3 PM Kanban tasks from voice note!');
      setProcessing(false);
    }, 1500);
  };

  return (
    <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 text-white shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>Gemini Voice Notes & Meeting Processor</span>
            </h4>
            <p className="text-[11px] text-slate-400">Transcribe voice calls, extract key actions & auto-create Kanban tasks</p>
          </div>
        </div>

        {isRecording && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime}</span>
          </span>
        )}
      </div>

      {/* Record Controls */}
      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={processing}
            className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Record Voice Note / Meeting Clip</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition cursor-pointer"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>Stop & Process Voice Actions</span>
          </button>
        )}

        <button
          type="button"
          onClick={simulateVoiceProcessing}
          disabled={isRecording || processing}
          className="px-3 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          title="Run Demo Voice Simulation"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </button>
      </div>

      {/* Processing State */}
      {processing && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
          <p className="text-xs font-bold text-slate-200">Gemini 3.5 Transcribe Processing Audio...</p>
          <p className="text-[11px] text-slate-400">Transcribing speech vectors and extracting action items for Kanban board.</p>
        </div>
      )}

      {/* Output Display */}
      {audioResult && !processing && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs animate-fadeIn">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transcript</span>
            <p className="text-slate-300 leading-relaxed italic text-[11px]">"{audioResult.transcript}"</p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Executive Summary</span>
            <p className="text-slate-200 font-medium text-[11px]">{audioResult.summary}</p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <ListTodo className="w-3.5 h-3.5" />
              <span>Extracted Action Items ({audioResult.actionItems?.length || 0})</span>
            </span>
            <ul className="space-y-1.5">
              {audioResult.actionItems?.map((item: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300 text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
