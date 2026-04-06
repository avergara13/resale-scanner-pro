/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

// GitHub Spark KV runtime
interface SparkKV {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
}

interface SparkRuntime {
  kv: SparkKV
}

interface Window {
  spark: SparkRuntime
}

// lucide-react deep imports used by shadcn/ui components
declare module 'lucide-react/dist/esm/icons/chevron-down' {
  import { LucideIcon } from 'lucide-react'
  const ChevronDown: LucideIcon
  export default ChevronDown
}
declare module 'lucide-react/dist/esm/icons/chevron-right' {
  import { LucideIcon } from 'lucide-react'
  const ChevronRight: LucideIcon
  export default ChevronRight
}
declare module 'lucide-react/dist/esm/icons/chevron-left' {
  import { LucideIcon } from 'lucide-react'
  const ChevronLeft: LucideIcon
  export default ChevronLeft
}
declare module 'lucide-react/dist/esm/icons/chevron-up' {
  import { LucideIcon } from 'lucide-react'
  const ChevronUp: LucideIcon
  export default ChevronUp
}
declare module 'lucide-react/dist/esm/icons/more-horizontal' {
  import { LucideIcon } from 'lucide-react'
  const MoreHorizontal: LucideIcon
  export default MoreHorizontal
}
declare module 'lucide-react/dist/esm/icons/arrow-left' {
  import { LucideIcon } from 'lucide-react'
  const ArrowLeft: LucideIcon
  export default ArrowLeft
}
declare module 'lucide-react/dist/esm/icons/arrow-right' {
  import { LucideIcon } from 'lucide-react'
  const ArrowRight: LucideIcon
  export default ArrowRight
}
declare module 'lucide-react/dist/esm/icons/check' {
  import { LucideIcon } from 'lucide-react'
  const Check: LucideIcon
  export default Check
}
declare module 'lucide-react/dist/esm/icons/search' {
  import { LucideIcon } from 'lucide-react'
  const Search: LucideIcon
  export default Search
}
declare module 'lucide-react/dist/esm/icons/circle' {
  import { LucideIcon } from 'lucide-react'
  const Circle: LucideIcon
  export default Circle
}
declare module 'lucide-react/dist/esm/icons/x' {
  import { LucideIcon } from 'lucide-react'
  const X: LucideIcon
  export default X
}
declare module 'lucide-react/dist/esm/icons/minus' {
  import { LucideIcon } from 'lucide-react'
  const Minus: LucideIcon
  export default Minus
}
declare module 'lucide-react/dist/esm/icons/grip-vertical' {
  import { LucideIcon } from 'lucide-react'
  const GripVertical: LucideIcon
  export default GripVertical
}
declare module 'lucide-react/dist/esm/icons/panel-left' {
  import { LucideIcon } from 'lucide-react'
  const PanelLeft: LucideIcon
  export default PanelLeft
}
