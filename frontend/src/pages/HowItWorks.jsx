import { Link } from 'react-router-dom'
import { Search, CalendarCheck, Handshake, Star, TrendingUp, FileText, ChevronDown, Compass, PlusCircle } from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: <Search className="w-10 h-10 mb-2" style={{ color: '#781F37' }} />,
      title: 'Browse clothing',
      desc: 'Filter available listings by category, size, budget, and pickup area. Check the owner-provided details.',
      color: '#781F37',
      bg: '#FDF2F5',
    },
    {
      num: '02',
      icon: <CalendarCheck className="w-10 h-10 mb-2" style={{ color: '#6D4AFF' }} />,
      title: 'Request your dates',
      desc: 'Choose dates and a handover option. ReWear checks overlapping requests before a listing appears as available.',
      color: '#6D4AFF',
      bg: '#F3F0FF',
    },
    {
      num: '03',
      icon: <Handshake className="w-10 h-10 mb-2" style={{ color: '#197B5B' }} />,
      title: 'Record the handover',
      desc: 'After confirming, the clothing owner marks the item as handed over. Both sides can follow the rental status.',
      color: '#197B5B',
      bg: '#EAF6F2',
    },
    {
      num: '04',
      icon: <Star className="w-10 h-10 mb-2" style={{ color: '#781F37' }} />,
      title: 'Return and review',
      desc: 'The renter marks the item returned, the owner confirms receipt, and then the renter can leave product feedback.',
      color: '#781F37',
      bg: '#FDF2F5',
    },
  ]

  const faqs = [
    { q: 'Is payment handled in the app?', a: 'No. ReWear records rental requests and estimates the applicable lender fee, but checkout, deposits, refunds, and payouts are not connected yet.' },
    { q: 'When can I leave a review?', a: 'After the clothing owner confirms the return and the rental is marked completed. Reviews are tied to that rental.' },
    { q: 'Are fit and care details verified?', a: 'Owners provide listing details. Ask them about sizing, condition, cleaning, delivery, and any deposit before agreeing to a rental.' },
    { q: 'How does AI Outfit Discovery work?', a: 'It interprets an optional text or consented inspiration image, then ReWear filters for dates and ranks listings using their saved details. Scores explain which signals contributed and do not guarantee fit.' },
    { q: 'Can I use my account on another device?', a: 'Yes. Sign in with the same account. Your profile, listings, rental activity, reviews, and saved discovery preferences are stored by the ReWear service.' },
    { q: 'Does the map show a seller’s address?', a: 'No. Listings use a broad area and rounded map coordinates. Exact seller addresses are not shown in discovery.' },
  ]

  return (
    <div className="min-h-screen bg-[#FFF9F1] text-[#18212B]">
      {/* Hero */}
      <section className="py-20 text-center bg-white border-b border-[#E8E1D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#781F37]">How ReWear Works</span>
          <h1 className="text-4xl md:text-5xl font-serif-couture font-bold mt-4 mb-6">
            Four steps to your <span className="italic text-[#781F37]">dream outfit</span>
          </h1>
          <p className="text-lg text-[#6F747A] max-w-2xl">
            Discover a piece for your dates, then follow the request, handover, and return steps from your wardrobe.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="bg-white rounded-2xl border border-[#E8E1D8] shadow-sm p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-6" style={{ backgroundColor: step.bg, color: step.color }}>
                  {step.num}
                </div>
                {step.icon}
                <h3 className="text-xl font-bold mb-3" style={{ color: step.color }}>{step.title}</h3>
                <p className="text-[#6F747A] text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Pillars */}
      <section className="py-20 bg-white border-y border-[#E8E1D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">What to expect</span>
            <h2 className="text-3xl font-serif-couture font-bold mt-2">Clear rental records</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <TrendingUp className="w-8 h-8 text-white" />,
                title: 'Status at each step',
                desc: 'Requests, handovers, returns, and completions each have a visible status in your wardrobe.',
                color: '#781F37',
              },
              {
                icon: <FileText className="w-8 h-8 text-white" />,
                title: 'Owner-provided details',
                desc: 'Review the listing and agree the final price, pickup, delivery, and care terms with its owner.',
                color: '#197B5B',
              },
              {
                icon: <Star className="w-8 h-8 text-white" />,
                title: 'Feedback after completion',
                desc: 'Only the renter on a completed rental can submit verified product feedback.',
                color: '#6D4AFF',
              },
            ].map((pillar) => (
              <div key={pillar.title} className="bg-[#FFF9F1] rounded-2xl border border-[#E8E1D8] p-8 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-sm" style={{ backgroundColor: pillar.color }}>
                  {pillar.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{pillar.title}</h3>
                <p className="text-[#6F747A] text-sm leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F747A]">FAQ</span>
            <h2 className="text-3xl font-serif-couture font-bold mt-2">Common Questions</h2>
          </div>

          <div className="flex flex-col gap-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="group bg-white rounded-2xl border border-[#E8E1D8] shadow-sm p-6 cursor-pointer">
                <summary className="flex justify-between items-center font-bold list-none">
                  {faq.q}
                  <ChevronDown className="w-5 h-5 text-[#781F37] transition-transform group-open:rotate-180 flex-shrink-0" />
                </summary>
                <p className="text-[#6F747A] mt-4 leading-relaxed text-sm">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#18212B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-serif-couture font-bold mb-4">
            Ready to look stunning without the price tag?
          </h2>
          <p className="text-lg text-stone-300 max-w-2xl mx-auto mb-10">
            Browse available pieces or share clothing from your wardrobe.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/" className="inline-flex items-center justify-center gap-2 bg-white text-[#18212B] hover:bg-stone-100 font-bold py-3 px-8 rounded-xl shadow-sm transition-colors">
              <Compass className="w-5 h-5" />
              Start Browsing
            </Link>
            <Link to="/my-closet" className="inline-flex items-center justify-center gap-2 bg-transparent text-white border border-stone-600 hover:bg-stone-800 font-bold py-3 px-8 rounded-xl transition-colors">
              <PlusCircle className="w-5 h-5" />
              List Your Wardrobe
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
