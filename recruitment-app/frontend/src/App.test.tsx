import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  test('renders login screen', () => {
    render(<App />)
    expect(screen.getByText(/採用管理 WEBアプリ/i)).toBeInTheDocument()
    expect(screen.getByText(/ログイン/i)).toBeInTheDocument()
    expect(screen.getByText(/初期パスワード/i)).toBeInTheDocument()
  })
})
