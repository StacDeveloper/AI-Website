import React, { useEffect, useState } from 'react'
import { useAuth, useUser } from "@clerk/clerk-react"
import { Heart } from 'lucide-react'
import api from '../lib/axios'
import toast from 'react-hot-toast'
import { QueryClient, useQuery } from "@tanstack/react-query"
const Community = () => {
  const { user } = useUser()
  const { getToken } = useAuth()


  const fetchCreation = async () => {
    try {
      const token = await getToken()
      const { data } = await api.get("/api/user/get-published-creations", { headers: { Authorization: `Bearer ${token}` } })
      console.log(data)
      if (data.success) return data.creations
      throw new Error(data.message)
    }

    catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  const { data: creations = [], isLoading, refetch } = useQuery({
    queryKey: ['get-creations'],
    queryFn: fetchCreation,
    throwOnError: (error) => toast.error(error)
  })




  const imageToggleLike = async (id) => {
    try {
      const token = await getToken()
      const { data } = await api.post("/api/user/toggle-like-creations", { id }, { headers: { Authorization: `Bearer ${token}` } })
      if (data.success) {
        toast.success(data.message)
        refetch()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error)
    }
  }


  return !isLoading ? (
    <div className='flex-1 h-full flex flex-col gap-4 p-6'>
      Creations
      <div className='bg-white h-full w-full rounded-xl overflow-y-scroll'>
        {creations.map((creat, index) => (
          <div key={index} className='relative group inline-block pl-3 pt-3 w-full sm:max-w-1/2 lg:max-w-1/3'>
            <img src={creat.content} alt="" className='w-full h-full object-cover rounded-lg' />
            <div className='absolute bottom-0 top-0 right-0 left-3 flex gap-2 items-end justify-end group-hover:justify-between p-3 group-hover:bg-gradient-to-b from-transparent to-black/80 text-white rounded-lg'>
              <p className='text-sm hidden group-hover:block'>{creat.prompt}</p>
              <div className='flex gap-1 items-center'>
                <p>{creat.likes.length}</p>
                <Heart onClick={() => imageToggleLike(creat.id)} className={`min-w-5 h-5 hover:scale-110 cursor-pointer ${creat.likes.includes(user.id) ? "fill-red-500 text-red-600" : "text-white"}`} />
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className='flex justify-center items-center h-full'>
      <span className='w-10 h-10 my-1 rounded-full border-3 border-primary border-t-transparent animate-spin'></span>
    </div>
  )
}

export default Community