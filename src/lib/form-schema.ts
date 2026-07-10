export type FormFieldType = 'text' | 'textarea' | 'email' | 'number' | 'date' | 'select' | 'checkbox'

export type FormField = {
  id: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: string[] // only meaningful for 'select'
}

export type FormSchema = {
  title: string
  fields: FormField[]
}

export type FormAnswers = Record<string, string | boolean>
