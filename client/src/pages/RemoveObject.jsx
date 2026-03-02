import { Scissors, Sparkles } from 'lucide-react'
import React, { useState } from 'react'
import api from '../lib/axios'
import toast from 'react-hot-toast'
import { useAuth } from '@clerk/clerk-react'
const RemoveObject = () => {

  const [input, SetInput] = useState("")
  const [object, SetObject] = useState("")
  const [loading, Setloading] = useState(false)
  const [content, Setcontent] = useState("")
  const { getToken } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      Setloading(true)
      const token = await getToken()

      if (object.split(" ").length > 1) {
        return toast.error("Please enter only 1 object name")
      }
      const formData = new FormData()
      formData.append('image', input)
      formData.append('object', object)
      const { data } = await api.post("/api/ai/remove-image-object", formData, { headers: { Authorization: `Bearer ${token}` } })
      if (data.success) {
        Setcontent(data.content)
        toast.success(`Remove ${object} from image`)
      }
      else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error)
    } finally {
      Setloading(false)
    }
  }

  return (
    <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
      {/* Left Col */}
      <form onSubmit={handleSubmit} className='w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200'>
        <div className='flex items-center gap-3'>
          <Sparkles className='w-6 text-[#4A7AFF]' />
          <h1 className='text-xl font-semibold'>Object Removal </h1>
        </div>
        <p className='mt-6 text-sm font-semibold'>Upload Image</p>

        <input
          onChange={(e) => SetInput(e.target.files[0])} accept='image/*'
          type="file"
          className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 text-gray-600'
          placeholder='The future of artificial intelligence is...'
          required
        />

        <p className='mt-6 text-sm font-medium'>Describe object name to remove</p>
        <textarea
          onChange={(e) => SetObject(e.target.value)} value={object}
          rows={4}
          className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300'
          placeholder='e.g., watch or spoon, Only single object name'
          required
        />


        <button disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#417DF6] to-[#8E37EB] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer'>
          {loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span> : <Scissors className='w-5' />}
          Remove Object
        </button>
      </form>
      {/* Right col */}
      <div className='w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96'>
        <div className='flex items-center gap-3'>
          <Scissors className='w-5 h-5 text-[#4A7AFF]' />
          <h1 className='text-xl font-semibold'>Processed Image</h1>
        </div>

        {!content ? (<div className='flex-1 flex justify-center items-center'>
          <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
            <Scissors className='w-9 h-9' />
            <p>Upload an image and click "Remove Object" to get started </p>
          </div>
        </div>) : (
          <div>
            <img src={content} alt="image" className='mt-3 w-full h-full' />
          </div>
        )}


      </div>
    </div>
  )
}

export default RemoveObject