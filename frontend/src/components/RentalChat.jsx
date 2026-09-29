import { useState, useEffect, useRef } from 'react'
import { apiRequest } from '../lib/api'
import { Send, MessageCircle, X } from 'lucide-react'

export default function RentalChat({ bookingId, currentUserId }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef(null)
  const pollRef = useRef(null)

  async function loadMessages() {
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}/messages`)
      setMessages(data)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    loadMessages()
    pollRef.current = setInterval(loadMessages, 8000)
    return () => clearInterval(pollRef.current)
  }, [isOpen, bookingId])

  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, isOpen])

  async function handleSend(e) {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const msg = await apiRequest(`/api/bookings/${bookingId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      setMessages((prev) => [...prev, msg])
      setNewMessage('')
    } catch (err) {
      setError(err.message || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#197B5B] hover:underline"
      >
        <MessageCircle className="w-4 h-4" />
        Chat with {currentUserId ? 'other party' : 'participant'}
      </button>
    )
  }

  return (
    <div className="mt-4 border border-[#E8E1D8] rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-[#E8E1D8]">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#197B5B]" />
          <span className="text-sm font-bold text-[#18212B]">Rental chat</span>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-[#18212B]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={containerRef} className="h-56 overflow-y-auto px-4 py-3 space-y-3 bg-[#FFF9F1]/50">
        {messages.length === 0 && (
          <p className="text-xs text-stone-400 text-center py-8">
            No messages yet. Coordinate pickup time and location here.
          </p>
        )}
        {messages.map((msg) => {
          const isMe = String(msg.senderId) === String(currentUserId)
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                  isMe
                    ? 'bg-[#18212B] text-white rounded-br-sm'
                    : 'bg-white border border-[#E8E1D8] text-[#18212B] rounded-bl-sm'
                }`}
              >
                {!isMe && <div className="text-[10px] font-bold text-[#781F37] mb-0.5">{msg.senderName}</div>}
                <div className="break-words">{msg.message}</div>
                <div className={`text-[10px] mt-1 ${isMe ? 'text-white/50' : 'text-stone-400'}`}>
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          )
        })}
        
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2 border-t border-[#E8E1D8] bg-white">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 bg-stone-50 outline-none focus:ring-1 focus:ring-[#197B5B]"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="p-2 rounded-lg bg-[#18212B] text-white hover:bg-[#2A3441] disabled:opacity-40 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      {error && <p className="text-xs text-red-600 px-3 pb-2">{error}</p>}
    </div>
  )
}

