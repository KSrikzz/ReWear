export default function ProductActivitySummary({ garment, reviews = [] }) {
  const latestReview = reviews.find((review) => review.garmentId === garment.id)

  return (
    <div className="flex flex-col gap-2 p-4 bg-[#FFF9F1] rounded-2xl border border-[#E8E1D8]">
      <p className="text-sm text-[#6F747A]">{garment.completedRentals || 0} completed rentals · {garment.totalRentalDays || 0} booked days · {garment.recordedCustodyDays || 0} recorded days out</p>
      <p className="text-sm font-medium text-[#18212B]">
        {garment.rating ? `★ ${garment.rating} · ${garment.reviewCount} customer review${garment.reviewCount === 1 ? '' : 's'}` : 'No customer reviews yet'}
      </p>
      {latestReview?.comment && <blockquote className="text-sm italic text-[#6F747A] border-l-2 border-[#E8E1D8] pl-3 mt-1">"{latestReview.comment}"</blockquote>}
    </div>
  )
}
