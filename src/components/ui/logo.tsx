'use client'

import { Receipt } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  collapsed?: boolean
}

interface Organization {
  id: string
  name: string
  logo_url: string | null
}

export function Logo({ className, size = 'md', showText = true, collapsed = false }: LogoProps) {
  const [imageError, setImageError] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()
  
  useEffect(() => {
    fetchOrganization()
  }, [])

  const fetchOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, logo_url')
          .eq('id', profile.organization_id)
          .single()

        if (org) {
          setOrganization(org)
        }
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  const logoUrl = organization?.logo_url
  const organizationName = organization?.name || 'FacturaSaaS'

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Logo/Icon */}
      <div className={cn(
        "flex items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0",
        sizeClasses[size]
      )}>
        {!loading && logoUrl && !imageError ? (
          <Image
            src={logoUrl}
            alt="Logo de la organización"
            width={size === 'sm' ? 24 : size === 'md' ? 32 : 40}
            height={size === 'sm' ? 24 : size === 'md' ? 32 : 40}
            className="rounded-lg object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <Receipt className={cn(
            "shrink-0",
            size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
          )} />
        )}
      </div>
      
      {/* Text */}
      {showText && !collapsed && (
        <span className={cn(
          "font-semibold truncate",
          textSizeClasses[size]
        )}>
          {organizationName}
        </span>
      )}
    </div>
  )
}