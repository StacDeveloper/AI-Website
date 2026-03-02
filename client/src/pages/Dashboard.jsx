import React, { useEffect, useState } from 'react'
import { dummyCreationData } from '../../public/assets'
import { Sparkles } from 'lucide-react'
import { Protect, useAuth } from '@clerk/clerk-react'
import CreationItem from '../components/CreationItem'
import api from '../lib/axios'
import toast from 'react-hot-toast'
const Dashboard = () => {

  const [creation, Setcreation] = useState([])
  const [loading, Setloading] = useState(true)
  const { getToken } = useAuth()

  const getDashBoardData = async () => {
    try {
      Setloading(false)
      const token = await getToken()
      const { data } = await api.get("/api/user/get-user-creations", { headers: { Authorization: `Bearer ${token}` } })
      if (data.success) {
        Setcreation(data.creations)
        console.log(data)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    } finally {
      Setloading(true)
    }
  }

  useEffect(() => {
    getDashBoardData()
  }, [])

  return loading ? (
    <div className='h-full overflow-y-scroll p-6'>
      <div className='flex justify-start gap-4 flex-wrap'>
        {/* Total Creation Card */}
        <div className='flex justify-between itesm-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200' >
          <div className='text-slate-600'>
            <p className='text-sm'>Total Creations</p>
            <h2 className='text-xl font-semibold'>{creation.length}</h2>
          </div>
          <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#3588F2] to-[#0BB0D7] text-white flex justify-center items-center'>
            <Sparkles className='w-5 text-white' />
          </div>
        </div>
        {/* Active Plan Card */}
        <div className='flex justify-between itesm-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200' >
          <div className='text-slate-600'>
            <p className='text-sm'>Active Plan</p>
            <h2 className='text-xl font-semibold'>
              <Protect plan="premium" fallback="Free">Premium</Protect>
            </h2>
          </div>
          <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF61C5] to-[#9E53EE] text-white flex justify-center items-center'>
            <Sparkles className='w-5 text-white' />
          </div>
        </div>
      </div>

      <div className='space-y-3'>
        <p className='mt-6 mb-4'>Recent Creations</p>
        {creation.map((creat) => (
          <CreationItem key={creat.id} item={creat} />
        ))}
      </div>


    </div>
  ) : <div className='flex justify-center items-center h-full'>
    <span className='w-10 h-10 my-1 rounded-full border-3 border-primary border-t-transparent animate-spin'></span>
  </div>
}

export default Dashboard