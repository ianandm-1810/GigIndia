export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const responseData = error?.response?.data

  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    return responseData.errors.map((item) => item.msg).filter(Boolean).join(' ')
  }

  return responseData?.message || error?.message || fallback
}
