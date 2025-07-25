'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2 } from 'lucide-react'


interface Product {
  id: string
  name: string
  description: string | null
  price: number
  category: string | null
  created_at: string
}

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: ''
  })

  const supabase = createClient()

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      fetchOrganization(user);
    } else {
      setLoading(false);
      setError("No se pudo obtener la información del usuario.");
    }
  };


  const fetchOrganization = async (user: SupabaseUser) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        fetchProducts(profile.organization_id)
      } else {
        setError('No se encontró una organización para este usuario.')
        setLoading(false)
      }
    } catch (error) {
      setError('Error al cargar la organización.')
      setLoading(false)
    }
  }

  const fetchProducts = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      setError('Error al cargar los productos.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) {
      alert('No se ha podido identificar la organización.')
      return
    }

    try {
      const productData = {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        category: formData.category || null,
        organization_id: organizationId
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData)
        if (error) throw error
      }

      closeModal()
      fetchProducts(organizationId)
    } catch (error) {
      alert('Error al guardar el producto.')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        category: product.category || ''
      })
    } else {
      setEditingProduct(null)
      setFormData({ name: '', description: '', price: '', category: '' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingProduct(null)
    setFormData({ name: '', description: '', price: '', category: '' })
  }

  const deleteProduct = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
      try {
        if (!organizationId) return
        
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id)

        if (error) throw error
        fetchProducts(organizationId)
      } catch (error) {
        alert('Error al eliminar el producto.')
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando productos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button onClick={initialize} className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600 text-sm sm:text-base">Gestiona todos tus productos y servicios</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Productos</h2>
        </div>
        
        {products.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No hay productos registrados</p>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full sm:w-auto"
            >
              Crear primer producto
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.description || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.category || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openModal(product)}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                            title="Editar Producto"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                            title="Eliminar Producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-200">
              {products.map((product) => (
                <div key={product.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">
                        {product.description || 'Sin descripción'}
                      </p>
                      {product.category && (
                        <p className="text-xs text-gray-500">{product.category}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-1">
                    <button
                      onClick={() => openModal(product)}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                      title="Editar Producto"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                      title="Eliminar Producto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-6">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <input type="text" name="description" value={formData.description} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} required min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input type="text" name="category" value={formData.category} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingProduct ? 'Actualizar Producto' : 'Crear Producto'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
