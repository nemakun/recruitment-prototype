import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  test('renders heading', () => {
    render(<App />)
    expect(screen.getByText(/勤怠管理/i)).toBeInTheDocument()
  })
})
