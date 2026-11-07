import { useLayoutEffect, useRef, useState } from 'react';
import type { UploadFile } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { isTouchDevice, pickDocument, pickMedia, takePhoto } from '@/lib/pickers';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import { IconCamera, IconFileText, IconImage, IconPaperclip, IconSend } from '../icons';
import { ActionSheet, IconButton } from '../ui';
import styles from './ChatComposer.module.css';

interface Props {
  onSend: (text: string) => void;
  onAttach: (file: UploadFile, caption: string) => void;
  onTyping: () => void;
  placeholder?: string;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function ChatComposer({ onSend, onAttach, onTyping, placeholder = 'Write a message…' }: Props) {
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = text.trim().length > 0;

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(120, area.scrollHeight)}px`;
  }, [text]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    areaRef.current?.focus();
  };

  const attach = (file: UploadFile | null | undefined) => {
    if (!file) return;
    if (file.size && file.size > MAX_FILE_BYTES) {
      feedback.error();
      toast.error('That file is too large', 'Chat attachments can be up to 15 MB.');
      return;
    }
    onAttach(file, text.trim());
    setText('');
  };

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <IconButton icon={IconPaperclip} label="Attach a photo or file" onClick={() => setMenu(true)} color={colors.text2} />
        <div className={styles.inputWrap}>
          <textarea
            ref={areaRef}
            rows={1}
            value={text}
            placeholder={placeholder}
            aria-label="Message"
            maxLength={4000}
            className={styles.input}
            enterKeyHint="send"
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value) onTyping();
            }}
            onKeyDown={(e) => {
              // Enter sends on computers; on phones it adds a new line and the button sends.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouchDevice()) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>
        <button
          type="button"
          className={`${styles.send} ${canSend ? styles.sendReady : ''}`}
          aria-label="Send message"
          disabled={!canSend}
          onMouseDown={(e) => e.preventDefault() /* keep the keyboard open */}
          onClick={send}
        >
          <IconSend size={19} color={colors.white} aria-hidden />
        </button>
      </div>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title="Share in this chat"
        actions={[
          { label: 'Photo from library', icon: IconImage, onClick: async () => attach((await pickMedia())[0]) },
          ...(isTouchDevice() ? [{ label: 'Take a photo', icon: IconCamera, onClick: async () => attach(await takePhoto()) }] : []),
          {
            label: 'Document or paper',
            description: 'PDF, Word, data files and more',
            icon: IconFileText,
            onClick: async () => attach(await pickDocument()),
          },
        ]}
      />
    </div>
  );
}
