import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ErrorComponentProps, useNavigate } from '@tanstack/react-router'

const ErrorBoundary: React.FC<ErrorComponentProps> = ({ error, reset }) => {
  const navigate = useNavigate()
  const handleBackToHome = () => {
    navigate({ to: '/' })
  }
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Error</h1>
      <div className="flex items-center gap-2 border bg-accent rounded-md px-2 py-1">
        <p>Error Name: {error?.name}</p>
        <Separator orientation="vertical" />
        <p>Error Message: {error?.message}</p>
      </div>
      <div className="flex flex-col gap-2 mt-4 bg-orange-50 rounded-md p-3 border border-orange-100">
        <pre className="text-sm">{error?.stack}</pre>

        <div className="flex gap-2 w-full justify-center items-center mt-4">
          <Button variant="ghost" onClick={handleBackToHome}>
            Back to Home
          </Button>
          <Button onClick={() => reset()}>Reset</Button>
        </div>
      </div>
    </div>
  )
}

export default ErrorBoundary
