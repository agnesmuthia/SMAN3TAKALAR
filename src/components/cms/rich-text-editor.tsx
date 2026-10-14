"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { uploadNewsImageAction } from "@/app/admin/berita/actions";

// Editor teks kaya untuk isi berita. HTML yang dihasilkan tetap disanitasi
// ulang di server sebelum disimpan.
export function RichTextEditor({ initialHtml, name }: { initialHtml: string; name: string }) {
  const [html, setHtml] = useState(initialHtml);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "prose-berita article-content min-h-80 max-w-none px-4 py-3 outline-none",
        "aria-label": "Isi berita",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => setHtml(e.getHTML()),
  });

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) return;
    setUploading(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadNewsImageAction(fd);
    setUploading(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const alt = window.prompt("Teks alternatif gambar (deskripsi singkat untuk pembaca layar):", "") ?? "";
    editor.chain().focus().setImage({ src: result.url, alt: alt.slice(0, 200) }).run();
  }

  function onLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Alamat tautan (https://… atau mailto:…). Kosongkan untuk menghapus tautan.", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) {
      setMessage("Tautan harus diawali https://, http://, atau mailto:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
      <input type="hidden" name={name} value={html} />
      {editor && <Toolbar editor={editor} onLink={onLink} onImage={() => fileRef.current?.click()} uploading={uploading} />}
      <EditorContent editor={editor} />
      {!editor && <div className="min-h-80 px-4 py-3 text-sm text-slate-400">Memuat editor…</div>}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickImage} />
      {message && <p role="alert" className="border-t border-slate-200 px-4 py-2 text-sm text-red-700">{message}</p>}
    </div>
  );
}

function Toolbar({ editor, onLink, onImage, uploading }: { editor: Editor; onLink: () => void; onImage: () => void; uploading: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const btn = (active: boolean) =>
    `rounded-md px-2.5 py-1.5 text-sm font-semibold transition ${active ? "bg-navy-900 text-white" : "text-slate-700 hover:bg-slate-100"}`;

  return (
    <div role="toolbar" aria-label="Format teks" className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
      <button type="button" className={btn(state.h2)} aria-pressed={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Judul</button>
      <button type="button" className={btn(state.h3)} aria-pressed={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>Subjudul</button>
      <span aria-hidden className="mx-1 w-px bg-slate-200" />
      <button type="button" className={btn(state.bold)} aria-pressed={state.bold} aria-label="Tebal" onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button type="button" className={btn(state.italic)} aria-pressed={state.italic} aria-label="Miring" onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button type="button" className={btn(state.underline)} aria-pressed={state.underline} aria-label="Garis bawah" onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
      <span aria-hidden className="mx-1 w-px bg-slate-200" />
      <button type="button" className={btn(state.bullet)} aria-pressed={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Daftar</button>
      <button type="button" className={btn(state.ordered)} aria-pressed={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Daftar</button>
      <button type="button" className={btn(state.quote)} aria-pressed={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Kutipan</button>
      <span aria-hidden className="mx-1 w-px bg-slate-200" />
      <button type="button" className={btn(state.link)} aria-pressed={state.link} onClick={onLink}>Tautan</button>
      <button type="button" className={btn(false)} onClick={onImage} disabled={uploading}>{uploading ? "Mengunggah…" : "Gambar"}</button>
      <span aria-hidden className="mx-1 w-px bg-slate-200" />
      <button type="button" className={btn(false)} aria-label="Urungkan" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>↶</button>
      <button type="button" className={btn(false)} aria-label="Ulangi" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>↷</button>
    </div>
  );
}
