'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Truck } from 'lucide-react'
import SearchInput from '@/components/ui/search-input'

interface Provider {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  rnc: string | null
  contact_person: string | null
  payment_terms: string | null
  notes: string | null
  created_at: string
}

export default function ProvidersClient() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    rnc: '',
    contact_person: '',
    payment_terms: '',
    notes: ''
  })

  const supabase = createClient()

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

  useEffect(() => {
    initialize();
  }, [])

  const fetchOrganization = async (user: SupabaseUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (error) {
        throw error
      }

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        fetchProviders(profile.organization_id)
      } else {
        setError('No se encontró una organización para este usuario.')
        setLoading(false)
      }
    } catch (error) {
      setError(`Error al cargar la organización: ${(error as any).message || error}`)
      setLoading(false)
    }
  }

  const fetchProviders = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) {
        throw error
      }
      setProviders(data || [])
      setFilteredProviders(data || [])
    } catch (error) {
      setError(`Error al cargar los proveedores: ${(error as any).message || error}`)
    } finally {
      setLoading(false)
    }
  }

  const filterProviders = (query: string) => {
    if (!query.trim()) {
      setFilteredProviders(providers)
      return
    }

    const filtered = providers.filter(provider =>
      provider.name.toLowerCase().includes(query.toLowerCase()) ||
      provider.email?.toLowerCase().includes(query.toLowerCase()) ||
      provider.phone?.toLowerCase().includes(query.toLowerCase()) ||
      provider.address?.toLowerCase().includes(query.toLowerCase()) ||
      provider.rnc?.toLowerCase().includes(query.toLowerCase()) ||
      provider.contact_person?.toLowerCase().includes(query.toLowerCase()) ||
      provider.payment_terms?.toLowerCase().includes(query.toLowerCase()) ||
      provider.notes?.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredProviders(filtered)
  }

  useEffect(() => {
    filterProviders(searchQuery)
  }, [searchQuery, providers])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) {
      alert('No se ha podido identificar la organización.')
      return
    }

    try {
      const providerData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        rnc: formData.rnc || null,
        contact_person: formData.contact_person || null,
        payment_terms: formData.payment_terms || null,
        notes: formData.notes || null,
        organization_id: organizationId
      }

      if (editingProvider) {
        const { error } = await supabase
          .from('providers')
          .update(providerData)
          .eq('id', editingProvider.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('providers')
          .insert(providerData)
        if (error) throw error
      }

      closeModal()
      fetchProviders(organizationId)
    } catch (error) {
      alert(`Error al ${editingProvider ? 'actualizar' : 'crear'} el proveedor.`)
    }
  }

  const openModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider(provider)
      setFormData({
        name: provider.name,
        email: provider.email || '',
        phone: provider.phone || '',
        address: provider.address || '',
        rnc: provider.rnc || '',
        contact_person: provider.contact_person || '',
        payment_terms: provider.payment_terms || '',
        notes: provider.notes || ''
      })
    } else {
      setEditingProvider(null)
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        rnc: '',
        contact_person: '',
        payment_terms: '',
        notes: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingProvider(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      rnc: '',
      contact_person: '',
      payment_terms: '',
      notes: ''
    })
  }

  const deleteProvider = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este proveedor? Esta acción no se puede deshacer.')) {
      try {
        if (!organizationId) return
        
        const { error } = await supabase
          .from('providers')
          .delete()
          .eq('id', id)

        if (error) throw error
        fetchProviders(organizationId)
      } catch (error) {
        alert('Error al eliminar el proveedor.')
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando proveedores...</span>
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600 text-sm sm:text-base">Gestiona todos tus proveedores</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span className="sm:inline">Nuevo Proveedor</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-4">
        <SearchInput
          placeholder="Buscar proveedores por nombre, email, teléfono, contacto o RNC..."
          onSearch={handleSearch}
          className="max-w-md"
        />
      </div>

      {/* Providers Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Proveedores</h2>
        </div>
        
        {filteredProviders.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'No se encontraron proveedores que coincidan con la búsqueda' : 'No hay proveedores registrados'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => openModal()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full sm:w-auto"
              >
                Crear primer proveedor
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RNC</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProviders.map((provider) => (
                    <tr key={provider.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{provider.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{provider.email || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{provider.phone || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{provider.contact_person || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{provider.rnc || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <button onClick={() => openModal(provider)} className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full" title="Editar Proveedor"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => deleteProvider(provider.id)} className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full" title="Eliminar Proveedor"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredProviders.map((provider) => (
                <div key={provider.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate flex-1 mr-2">{provider.name}</h3>
                    <div className="flex space-x-1 flex-shrink-0">
                      <button
                        onClick={() => openModal(provider)}
                        className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                        title="Editar Proveedor"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteProvider(provider.id)}
                        className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                        title="Eliminar Proveedor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p className="truncate">{provider.email || 'Sin email'}</p>
                    {provider.phone && <p>{provider.phone}</p>}
                    {provider.contact_person && <p>Contacto: {provider.contact_person}</p>}
                    {provider.rnc && <p>RNC: {provider.rnc}</p>}
                    {provider.payment_terms && <p>Términos: {provider.payment_terms}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-6">{editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RNC</label>
                  <input
                    type="text"
                    value={formData.rnc}
                    onChange={(e) => setFormData({...formData, rnc: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Términos de Pago</label>
                  <input
                    type="text"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                    placeholder="Ej: 30 días, Inmediato, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 w-full sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {editingProvider ? 'Actualizar Proveedor' : 'Crear Proveedor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
