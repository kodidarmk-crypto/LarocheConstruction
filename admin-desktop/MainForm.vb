Imports System.Diagnostics
Imports System.Drawing
Imports System.IO
Imports System.Text.Json
Imports System.Text.RegularExpressions
Imports System.Windows.Forms
Imports Microsoft.Web.WebView2.Core
Imports Microsoft.Web.WebView2.WinForms

Public Class MainForm
    Inherits Form

    Private ReadOnly _urlBox As New TextBox()
    Private ReadOnly _openButton As New Button()
    Private ReadOnly _status As New Label()
    Private ReadOnly _browser As New Microsoft.Web.WebView2.WinForms.WebView2()
    Private ReadOnly _settingsPath As String = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Laroche Construction",
        "AdminDesktop",
        "settings.json")
    Private _baseUri As Uri

    Public Sub New()
        Text = "Laroche Construction — Administration"
        MinimumSize = New Size(980, 680)
        StartPosition = FormStartPosition.CenterScreen
        BackColor = Color.FromArgb(245, 242, 235)

        Dim top As New Panel With {
            .Dock = DockStyle.Top,
            .Height = 94,
            .Padding = New Padding(18, 14, 18, 10),
            .BackColor = Color.FromArgb(16, 28, 46)
        }
        Dim title As New Label With {
            .Text = "Laroche Construction | Administration",
            .Dock = DockStyle.Top,
            .Height = 28,
            .ForeColor = Color.White,
            .Font = New Font("Segoe UI", 14, FontStyle.Bold)
        }
        top.Controls.Add(title)

        Dim row As New Panel With {.Dock = DockStyle.Fill, .Padding = New Padding(0, 8, 0, 0)}
        top.Controls.Add(row)
        _urlBox.Dock = DockStyle.Fill
        _urlBox.PlaceholderText = "https://votre-projet.vercel.app"
        _urlBox.Font = New Font("Segoe UI", 10)
        _openButton.Dock = DockStyle.Right
        _openButton.Width = 160
        _openButton.Text = "Ouvrir l’administration"
        _openButton.BackColor = Color.FromArgb(232, 185, 51)
        _openButton.FlatStyle = FlatStyle.Flat
        _openButton.Font = New Font("Segoe UI", 9, FontStyle.Bold)
        AddHandler _openButton.Click, AddressOf AddressButtonClick
        row.Controls.Add(_urlBox)
        row.Controls.Add(_openButton)

        _browser.Dock = DockStyle.Fill
        _browser.CreationProperties = New CoreWebView2CreationProperties With {
            .UserDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Laroche Construction",
                "AdminDesktop",
                "WebView2")
        }
        _status.Dock = DockStyle.Bottom
        _status.Height = 30
        _status.Padding = New Padding(12, 6, 12, 0)
        _status.Text = "Aucun mot de passe ni aucune clé serveur n’est enregistré par cette application."
        _status.ForeColor = Color.FromArgb(74, 83, 94)

        Controls.Add(_browser)
        Controls.Add(_status)
        Controls.Add(top)
        AddHandler Shown, AddressOf FormShown
        AddHandler FormClosing, AddressOf FormClosingSave
    End Sub

    Private Async Sub FormShown(sender As Object, e As EventArgs)
        LoadSavedAddress()
        Try
            Await _browser.EnsureCoreWebView2Async()
            Dim settings = _browser.CoreWebView2.Settings
            settings.AreDevToolsEnabled = False
            settings.IsPasswordAutosaveEnabled = False
            settings.IsGeneralAutofillEnabled = False
            AddHandler _browser.CoreWebView2.NavigationStarting, AddressOf BrowserNavigationStarting
            AddHandler _browser.CoreWebView2.NewWindowRequested, AddressOf NewWindowRequested
            If _baseUri IsNot Nothing Then NavigateAdmin()
        Catch
            _status.Text = "WebView2 est indisponible. Installez le Microsoft Edge WebView2 Runtime puis relancez l’application."
        End Try
    End Sub

    Private Sub AddressButtonClick(sender As Object, e As EventArgs)
        Dim candidate As Uri = Nothing
        If Not TryValidateBaseUrl(_urlBox.Text, candidate) Then
            MessageBox.Show(
                "Entrez l’URL HTTPS de votre site larocheconstruction.com ou de votre projet Vercel. Pour un test local, utilisez http://localhost:<port>.",
                "Adresse refusée",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning)
            Return
        End If

        _baseUri = candidate
        _urlBox.Text = candidate.ToString().TrimEnd("/"c)
        SaveAddress()
        If _browser.CoreWebView2 Is Nothing Then
            _status.Text = "Initialisation du navigateur…"
            Return
        End If
        NavigateAdmin()
    End Sub

    Private Sub NavigateAdmin()
        If _baseUri Is Nothing OrElse _browser.CoreWebView2 Is Nothing Then Return
        Dim target = New Uri(_baseUri, "/page/admin.html")
        _browser.CoreWebView2.Navigate(target.ToString())
        _status.Text = "Connectez-vous avec le compte Supabase Auth autorisé et le PIN admin."
    End Sub

    Private Sub BrowserNavigationStarting(sender As Object, e As CoreWebView2NavigationStartingEventArgs)
        Dim target As Uri = Nothing
        If Not Uri.TryCreate(e.Uri, UriKind.Absolute, target) Then
            e.Cancel = True
            Return
        End If

        If _baseUri IsNot Nothing AndAlso
           target.Scheme.Equals(_baseUri.Scheme, StringComparison.OrdinalIgnoreCase) AndAlso
           target.Host.Equals(_baseUri.Host, StringComparison.OrdinalIgnoreCase) AndAlso
           target.Port = _baseUri.Port Then Return

        e.Cancel = True
        OpenExternalSafely(target)
    End Sub

    Private Sub NewWindowRequested(sender As Object, e As CoreWebView2NewWindowRequestedEventArgs)
        e.Handled = True
        Dim target As Uri = Nothing
        If Uri.TryCreate(e.Uri, UriKind.Absolute, target) Then OpenExternalSafely(target)
    End Sub

    Private Sub OpenExternalSafely(target As Uri)
        If target.Scheme <> Uri.UriSchemeHttps Then Return
        Try
            Process.Start(New ProcessStartInfo(target.ToString()) With {.UseShellExecute = True})
        Catch
            _status.Text = "Impossible d’ouvrir le lien externe."
        End Try
    End Sub

    Private Shared Function TryValidateBaseUrl(raw As String, ByRef result As Uri) As Boolean
        result = Nothing
        If String.IsNullOrWhiteSpace(raw) Then Return False
        Dim candidate As Uri = Nothing
        If Not Uri.TryCreate(raw.Trim(), UriKind.Absolute, candidate) Then Return False
        If Not String.IsNullOrEmpty(candidate.UserInfo) OrElse candidate.Query <> "" OrElse candidate.Fragment <> "" Then Return False

        Dim isLocal = candidate.Scheme = Uri.UriSchemeHttp AndAlso
                      (candidate.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) OrElse candidate.Host.Equals("127.0.0.1", StringComparison.Ordinal))
        Dim isSecureSite = candidate.Scheme = Uri.UriSchemeHttps AndAlso IsApprovedHost(candidate.Host)
        If Not isLocal AndAlso Not isSecureSite Then Return False

        Dim builder As New UriBuilder(candidate) With {.Path = "/", .Query = "", .Fragment = ""}
        result = builder.Uri
        Return True
    End Function

    Private Shared Function IsApprovedHost(host As String) As Boolean
        Dim normalized = host.TrimEnd("."c).ToLowerInvariant()
        Return normalized = "larocheconstruction.com" OrElse
               normalized.EndsWith(".larocheconstruction.com", StringComparison.Ordinal) OrElse
               Regex.IsMatch(normalized, "^[a-z0-9-]+\.vercel\.app$", RegexOptions.CultureInvariant)
    End Function

    Private Sub LoadSavedAddress()
        Try
            If Not File.Exists(_settingsPath) Then Return
            Dim data = JsonSerializer.Deserialize(Of AppSettings)(File.ReadAllText(_settingsPath))
            Dim candidate As Uri = Nothing
            If data IsNot Nothing AndAlso TryValidateBaseUrl(data.BaseUrl, candidate) Then
                _baseUri = candidate
                _urlBox.Text = candidate.ToString().TrimEnd("/"c)
            End If
        Catch
            _status.Text = "L’adresse précédente n’a pas pu être lue; saisissez l’URL de votre site."
        End Try
    End Sub

    Private Sub SaveAddress()
        Try
            Directory.CreateDirectory(Path.GetDirectoryName(_settingsPath))
            File.WriteAllText(_settingsPath, JsonSerializer.Serialize(New AppSettings With {.BaseUrl = _baseUri.ToString()}))
        Catch
            _status.Text = "L’adresse est utilisable, mais n’a pas pu être mémorisée."
        End Try
    End Sub

    Private Sub FormClosingSave(sender As Object, e As FormClosingEventArgs)
        If _baseUri IsNot Nothing Then SaveAddress()
    End Sub

    Private Class AppSettings
        Public Property BaseUrl As String = ""
    End Class
End Class
