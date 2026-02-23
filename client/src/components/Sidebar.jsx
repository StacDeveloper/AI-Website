import { Protect, useClerk, useUser } from '@clerk/clerk-react'
import { Eraser, FileText, Hash, House, Image, LogOut, Scissors, SquarePen, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'



const Sidebar = ({ sidebar, SetSidebar }) => {

    const { user } = useUser()
    const { openUserProfile, signOut } = useClerk()
    const navItems = [
        { to: "/ai", label: "Dashboard", icon: House },
        { to: "/ai/write-articles", label: "Write Article", icon: SquarePen },
        { to: "/ai/blog-titles", label: "Blog Titles", icon: Hash },
        { to: "/ai/generate-images", label: "Generate Images", icon: Image },
        { to: "/ai/remove-background", label: "Remove Background", icon: Eraser },
        { to: "/ai/remove-object", label: "Remove Object", icon: Scissors },
        { to: "/ai/review-resume", label: "Review Resume", icon: FileText },
        { to: "/ai/community", label: "Community", icon: Users },

    ]

    return (
        <div className={`w-60 bg-white border-r border-gray-200 flex flex-col justify-between items-center max-sm:absolute top-14 bottom-0 ${sidebar ? "translate-x-0" : "max-sm-translate-x-full"} transition-all duration-300 ease-in-out`}>
            <div className='my-8 w-full'>
                <img src={user.imageUrl} alt="user-image" className='w-13 rounded-full mx-auto' />
                <h1 className='mt-1 text-center'>{user.fullName}</h1>
                <div className='px-6 mt-5 text-sm text-gray-600 font-medium'>
                    {navItems.map((nav) => (
                        <NavLink key={nav.to} to={nav.to} end={nav.to === "/ai"} onClick={() => SetSidebar(false)} className={({ isActive }) => `px-3.5 py-3.5 flex items-center gap-3 rounded ${isActive ? "bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white" : " "}`}>
                            {({ isActive }) => (
                                <>
                                    <nav.icon className={`w-4 h-4 ${isActive ? "text-white" : " "}`} />{nav.label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </div>
            <div className='w-full border-t border-gray-200 p-4 px-7 flex items-center justify-between'>
                <div onClick={openUserProfile} className='flex gap-2 itesm-center cursor-pointer'>
                    <img src={user.imageUrl} className='w-8 rounded-full' alt="user-image" />
                    <div>
                        <h1 className='text-sm font-medium'>{user.fullName}</h1>
                        <p className='text-xs text-gray-500'>
                            <Protect plan={"premium"} fallback="free" >Premium</Protect> Plan
                        </p>
                    </div>
                </div>
                <LogOut onClick={signOut} className='w-4.5 text-gray-400 hover:text-gray-700 transition cursor-pointer' />
            </div>
        </div>
    )
}

export default Sidebar