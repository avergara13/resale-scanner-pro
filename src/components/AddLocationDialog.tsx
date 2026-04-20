import { useState } from 'react'
import { MapPin, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ThriftStoreLocation } from '@/types'

interface AddLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (location: ThriftStoreLocation) => void
  existingLocations?: ThriftStoreLocation[]
}

function createLocationId(): string {
  return `loc-${crypto.randomUUID()}`
}

export function AddLocationDialog({ open, onOpenChange, onSave, existingLocations = [] }: AddLocationDialogProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [newLocation, setNewLocation] = useState<Partial<ThriftStoreLocation>>({
    name: '',
    city: '',
    state: '',
    zipCode: '',
    type: 'thrift-store'
  })

  const handleSave = () => {
    if (isCreatingNew) {
      const location: ThriftStoreLocation = {
        id: createLocationId(),
        name: newLocation.name || 'Unnamed Location',
        address: newLocation.address,
        city: newLocation.city,
        state: newLocation.state,
        zipCode: newLocation.zipCode,
        type: newLocation.type || 'thrift-store'
      }
      onSave(location)
    } else if (selectedLocationId) {
      const existing = existingLocations.find(loc => loc.id === selectedLocationId)
      if (existing) {
        onSave(existing)
      }
    }
    handleClose()
  }

  const handleClose = () => {
    setIsCreatingNew(false)
    setSelectedLocationId('')
    setNewLocation({
      name: '',
      city: '',
      state: '',
      zipCode: '',
      type: 'thrift-store'
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-card border-s1 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-t1">
            <MapPin size={20} weight="fill" className="text-b1" />
            Add Location
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isCreatingNew && existingLocations.length > 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-t2 text-xs font-bold uppercase">Select Existing Location</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger className="bg-bg border-s2">
                    <SelectValue placeholder="Choose a location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} {loc.city ? `- ${loc.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-s2" />
                <span className="text-xs text-t3 font-medium">OR</span>
                <div className="flex-1 h-px bg-s2" />
              </div>
            </>
          )}

          {isCreatingNew || existingLocations.length === 0 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-t2 text-xs font-bold uppercase">Store Name *</Label>
                <Input
                  id="name"
                  value={newLocation.name}
                  onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
                  placeholder="e.g. Goodwill Austin Central"
                  className="bg-bg border-s2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" className="text-t2 text-xs font-bold uppercase">Store Type</Label>
                <Select
                  value={newLocation.type}
                  onValueChange={value => setNewLocation({ ...newLocation, type: value as ThriftStoreLocation['type'] })}
                >
                  <SelectTrigger className="bg-bg border-s2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goodwill">Goodwill</SelectItem>
                    <SelectItem value="salvation-army">Salvation Army</SelectItem>
                    <SelectItem value="thrift-store">Thrift Store</SelectItem>
                    <SelectItem value="estate-sale">Estate Sale</SelectItem>
                    <SelectItem value="garage-sale">Garage Sale</SelectItem>
                    <SelectItem value="flea-market">Flea Market</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-t2 text-xs font-bold uppercase">City</Label>
                  <Input
                    id="city"
                    value={newLocation.city}
                    onChange={e => setNewLocation({ ...newLocation, city: e.target.value })}
                    placeholder="Austin"
                    className="bg-bg border-s2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state" className="text-t2 text-xs font-bold uppercase">State</Label>
                  <Input
                    id="state"
                    value={newLocation.state}
                    onChange={e => setNewLocation({ ...newLocation, state: e.target.value })}
                    placeholder="TX"
                    className="bg-bg border-s2"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-t2 text-xs font-bold uppercase">Address (Optional)</Label>
                <Input
                  id="address"
                  value={newLocation.address}
                  onChange={e => setNewLocation({ ...newLocation, address: e.target.value })}
                  placeholder="123 Main St"
                  className="bg-bg border-s2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode" className="text-t2 text-xs font-bold uppercase">ZIP Code (Optional)</Label>
                <Input
                  id="zipCode"
                  value={newLocation.zipCode}
                  onChange={e => setNewLocation({ ...newLocation, zipCode: e.target.value })}
                  placeholder="78701"
                  className="bg-bg border-s2"
                  maxLength={5}
                />
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed border-b1 text-b1 hover:bg-blue-bg"
              onClick={() => setIsCreatingNew(true)}
            >
              <Plus size={16} weight="bold" className="mr-2" />
              Create New Location
            </Button>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isCreatingNew ? !newLocation.name : !selectedLocationId}
            className="flex-1 bg-gradient-to-br from-b1 to-amber hover:opacity-90 text-white"
          >
            Save Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
