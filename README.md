# Facebook Authentication Automation

A comprehensive Facebook authentication automation system built with Playwright and Node.js. This project provides automated login functionality with persistent cookies, browser cache management, session control, and a modern web interface.

## 🚀 Features

### Core Functionality

- **Automated Facebook Login**: Secure login automation using Playwright
- **Persistent Cookies**: 7-day cookie storage with automatic cleanup
- **Browser Cache Management**: Per-user cache directories with optimized settings
- **Session Management**: Multiple concurrent sessions with manual control
- **Quick Login**: Login using only email (leverages saved cookies and cache)

### Web Interface

- **Modern 5-Tab Interface**: Login, Sessions, Cookies, Cache, and Info tabs
- **Real-time Updates**: Auto-refresh every 30 seconds
- **Visual Management**: Easy cookie and cache management
- **Responsive Design**: Color-coded sections for better UX

### Advanced Features

- **Debug System**: Optional debug mode with screenshots and DOM snapshots
- **Error Handling**: Comprehensive error handling and user feedback
- **Data Persistence**: Automatic cleanup of expired cookies
- **Multi-user Support**: Handle multiple Facebook accounts simultaneously

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Windows, macOS, or Linux

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd fb-playwright-nodejs
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🔧 Configuration

### Debug Mode

To enable debug mode, set `DEBUG_ENABLED` to `true` in `server.js`:

```javascript
const DEBUG_ENABLED = true; // Set to false in production
```

### Port Configuration

The default port is 3000. You can change it by modifying the `PORT` variable in `server.js`.

## 📖 Usage

### Normal Login

1. Go to the **Login** tab
2. Enter Facebook email and password
3. Click "Login with Facebook"
4. The system will handle the authentication process

### Quick Login

1. Go to the **Login** tab
2. Enter only the email address
3. Click "Quick Login"
4. Uses saved cookies and cache for instant access

### Session Management

- View active sessions in the **Sessions** tab
- Monitor session uptime and status
- Close sessions manually when needed

### Cookie Management

- View saved cookies in the **Cookies** tab
- See expiration dates and metadata
- Delete user data (cookies + cache) as needed
- Clean expired cookies automatically

### Cache Information

- Monitor browser cache usage in the **Cache** tab
- View cache directories and sizes
- Understand cache optimization settings

## 📁 Project Structure

```
fb-playwright-nodejs/
├── server.js              # Main server with all endpoints
├── helpers.js             # Utility functions and selectors
├── public/
│   └── index.html         # Web interface (5-tab design)
├── cookies/               # Persistent cookies and session data
├── cache/                 # Browser cache directories (per user)
├── debug/                 # Debug files (when enabled)
├── package.json           # Project dependencies
├── README.md              # This file
├── README-ES.md           # Spanish documentation
└── .gitignore            # Git ignore rules
```

## 🔌 API Endpoints

### Authentication

- `POST /login` - Normal login with email and password
- `POST /quick-login` - Quick login using saved cookies

### Session Management

- `GET /sessions` - List all active sessions
- `POST /close-session` - Close a specific session

### Data Management

- `GET /cookies` - List saved cookies with metadata
- `DELETE /cookies/:email` - Delete user data (cookies + cache)
- `POST /clean-cookies` - Clean expired cookies

### Information

- `GET /cache` - Browser cache information
- `GET /debug` - Debug files (if debug mode enabled)

## 🛡️ Security Features

- **No Password Storage**: Passwords are never stored, only used for authentication
- **Secure Cookie Handling**: Cookies are stored locally and expire automatically
- **Session Isolation**: Each user has isolated browser sessions and cache
- **Debug Control**: Debug mode can be disabled for production use

## 🔍 Troubleshooting

### Common Issues

1. **Login Stuck on Loading**

   - Check if Facebook shows additional dialogs (save login info, etc.)
   - Enable debug mode to capture screenshots
   - Clear cookies and cache for the affected user

2. **Cookies Not Working**

   - Ensure cookies directory has proper permissions
   - Check if cookies have expired (7-day limit)
   - Use the clean cookies function to remove old data

3. **Cache Issues**
   - Verify cache directories exist and are writable
   - Check disk space availability
   - Clear cache directory if corrupted

### Debug Mode

Enable debug mode to capture:

- Screenshots of the login process
- DOM snapshots for analysis
- Console logs with detailed information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is for educational purposes only. Please ensure compliance with Facebook's Terms of Service and applicable laws when using this software.

## ⚠️ Disclaimer

This tool is intended for legitimate automation purposes only. Users are responsible for complying with Facebook's Terms of Service and all applicable laws and regulations. The authors are not responsible for any misuse of this software.

## 🌟 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for reliable browser automation
- Uses [Express.js](https://expressjs.com/) for the web server
- Modern web interface with vanilla JavaScript and CSS

---

For Spanish documentation, see [README-ES.md](README-ES.md)
