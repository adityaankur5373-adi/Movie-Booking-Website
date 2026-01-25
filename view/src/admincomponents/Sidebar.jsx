import React from 'react'
import { assets } from '../assets/assets'
import { LayoutDashboardIcon,ListIcon,PlusSquareIcon,ListCollapseIcon,PlusCircle,Clapperboard,Monitor  } from 'lucide-react'
import { NavLink } from 'react-router-dom'
const Sidebar = () => {
    const user = {
        firstName:'Admin',
        lastName:'User',
        imageUrl:assets.profile,
    }
    const adminNavlinks = [
        {name:'Dashboard',path:'/admin',icon:LayoutDashboardIcon},
        {name:'List Shows',path:'/admin/shows-list',icon:ListIcon},
        {name:'List Bookings',path:'/admin/booking-list',icon:ListCollapseIcon},
       {name:'Add Movies',path:'/admin/create-movie',icon: PlusCircle},
       {name:'Add Threater',path:'/admin/create-theatre',icon: Clapperboard },
        {name:'Add Screen',path:'/admin/create-screen',icon: Monitor },
        {name:'Add Shows',path:'/admin/add-movies',icon:PlusSquareIcon},
    ]
  return (
     <div className="h-[calc(100vh-64px)] w-16 md:w-64 flex flex-col items-center pt-8 border-r border-gray-300/20 text-sm">
      <img className='h-9 md:h-14 w-9 md:w-14 rounded-full mx-auto' src={user.imageUrl} alt='sidebar'/>
      <p className='mt-2 text-base max-md:hidden'>{user.firstName} {user.lastName}</p>
      <div className='w-full'>
        {adminNavlinks.map((link,index) => (
           <NavLink key={index} to={link.path} end className={({isActive}) => `relative flex items-center max-md:justify-center gap-2 w-full
           py-2.5 md:pl-10 first:mt-6 text-gray-400 ${isActive && 'bg-primary/15 text-primary group'}`}>
               {({isActive}) => (
                <>
                <link.icon className='w-5 h-5'/>
                <p className='max-md:hidden'>{link.name}</p>
                <span className={`w-1.5 h-10 rounded-1 right-0 absolute ${isActive && 'bg-primary'}`}/>

                </>
               )}
            </NavLink>
        ))}
      </div>
    </div>
  )
}

export default Sidebar