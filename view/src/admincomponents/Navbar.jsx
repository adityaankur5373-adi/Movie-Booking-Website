
import { Link } from 'react-router-dom'
import { Ticket } from 'lucide-react'
const Navbar = () => {
  return (
    <div className='flex items-center justify-between px-6 md:px-10 h-16 border-b border-gray-300/30'>
         <Link to="/" className="flex items-center gap-2 flex-1 md:flex-none">
  <Ticket className="w-10 h-10 text-primary" />
  <span className="text-xl font-bold">
    MovieShow
  </span>
</Link>
    </div>
  )
}

export default Navbar
