import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import get from "lodash/get"
import { AxiosError } from "axios"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return get(error, "response.data.error", error.message) as string
  }
  if (error instanceof Error) return error.message
  return "Something went wrong"
}
