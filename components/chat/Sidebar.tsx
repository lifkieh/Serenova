import React from "react";
import { History, X, Plus, Edit2, Archive, Trash2, Check, ArchiveRestore } from "lucide-react";

export type Conversation = {
  id: string;
  title: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  lang: "en" | "id";
  onRename: (id: string, title: string) => void;
  onArchiveToggle: (id: string, isArchived: boolean) => void;
  onDelete: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  editingId: string | null;
  editTitle: string;
  onEditStart: (id: string, title: string) => void;
  onEditChange: (title: string) => void;
  onEditCancel: () => void;
  mode?: "journal" | "chill";
};

export default function Sidebar({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  lang,
  onRename,
  onArchiveToggle,
  onDelete,
  searchQuery,
  onSearchChange,
  editingId,
  editTitle,
  onEditStart,
  onEditChange,
  onEditCancel,
  mode = "journal",
}: SidebarProps) {
  const isChill = mode === "chill";
  const t = {
    activeConversations: isChill 
        ? (lang === "id" ? "Sesi Santuy" : "Chill Sessions")
        : (lang === "id" ? "Momen Hening" : "Quiet Moments"),
    newChat: lang === "id" ? "Percakapan Baru" : "New Conversation",
    searchPlaceholder: lang === "id" ? "Cari percakapan..." : "Search conversations...",
    emptySidebar: lang === "id" ? "Belum ada percakapan tersimpan." : "No conversations recorded yet.",
    rename: lang === "id" ? "Ubah Nama" : "Rename",
    archive: lang === "id" ? "Arsip" : "Archive",
    unarchive: lang === "id" ? "Pulihkan" : "Unarchive",
    delete: lang === "id" ? "Hapus" : "Delete",
    archivedConversations: lang === "id" ? "Percakapan yang diarsipkan" : "Archived conversations",
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeConversations = filteredConversations.filter((c) => !c.isArchived);
  const archivedConversations = filteredConversations.filter((c) => c.isArchived);

  return (
    <>
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-zinc-950 border-r border-white/10 flex flex-col transform transition-transform duration-300 ease-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-500" />
            {t.activeConversations}
          </span>
          <button
            onClick={onClose}
            className="md:hidden text-zinc-500 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-white/5 hover:border-white/15 text-xs text-zinc-400 hover:text-white py-2.5 px-4 rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.newChat}
          </button>
          
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 focus:border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">
          {/* Active section */}
          <div className="space-y-1">
            {activeConversations.length === 0 && archivedConversations.length === 0 ? (
              <p className="text-xs text-zinc-700 text-center py-8 px-4 leading-relaxed">
                {t.emptySidebar}
              </p>
            ) : (
              activeConversations.map((c) => (
                <div
                  key={c.id}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    activeConversationId === c.id
                      ? "bg-zinc-900 text-white"
                      : "hover:bg-zinc-900/50 text-zinc-400"
                  }`}
                >
                  {editingId === c.id ? (
                    <input
                      value={editTitle}
                      onChange={(e) => onEditChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onRename(c.id, editTitle);
                        if (e.key === "Escape") onEditCancel();
                      }}
                      className="bg-black border border-white/10 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full mr-8"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => onSelect(c.id)}
                      className="flex-1 text-left text-xs truncate pr-16"
                    >
                      {c.title || "New Conversation"}
                    </button>
                  )}

                  <div className="absolute right-2 flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 md:bg-transparent pl-2 py-0.5">
                    {editingId === c.id ? (
                      <>
                        <button
                          onClick={() => onRename(c.id, editTitle)}
                          className="p-1 text-green-500 hover:text-green-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={onEditCancel}
                          className="p-1 text-red-500 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onEditStart(c.id, c.title)}
                          className="p-1 text-zinc-500 hover:text-zinc-300"
                          title={t.rename}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onArchiveToggle(c.id, false)}
                          className="p-1 text-zinc-500 hover:text-zinc-300"
                          title={t.archive}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(c.id)}
                          className="p-1 text-zinc-500 hover:text-red-400"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Archived section */}
          {archivedConversations.length > 0 && (
            <div className="space-y-1 border-t border-white/5 pt-4">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 px-3 block mb-2">
                {t.archivedConversations}
              </span>
              {archivedConversations.map((c) => (
                <div
                  key={c.id}
                  className={`group relative flex items-center justify-between p-2 rounded-xl transition-colors opacity-60 ${
                    activeConversationId === c.id
                      ? "bg-zinc-900 text-white"
                      : "hover:bg-zinc-900/45 text-zinc-500"
                  }`}
                >
                  <button
                    onClick={() => onSelect(c.id)}
                    className="flex-1 text-left text-xs truncate pr-12"
                  >
                    {c.title}
                  </button>

                  <div className="absolute right-2 flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 md:bg-transparent pl-2 py-0.5">
                    <button
                      onClick={() => onArchiveToggle(c.id, true)}
                      className="p-1 text-zinc-500 hover:text-zinc-300"
                      title={t.unarchive}
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="p-1 text-zinc-500 hover:text-red-400"
                      title={t.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 text-[10px] text-zinc-600 text-center">
          Serenova is a safe harbor.
        </div>
      </div>

      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
        />
      )}
    </>
  );
}
