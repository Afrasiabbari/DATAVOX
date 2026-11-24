using Microsoft.Win32;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using Forms = System.Windows.Forms;

namespace DATAVOX {
 public partial class MainWindow : Window {
  private string sourcePath, destinationPath;
  private CancellationTokenSource cancellation;
  private bool lightTheme = false;
  public MainWindow() { InitializeComponent(); }
  private void CopyNav_Click(object s, RoutedEventArgs e) { CopyPage.Visibility=Visibility.Visible; SettingsPage.Visibility=Visibility.Collapsed; }
  private void SettingsNav_Click(object s, RoutedEventArgs e) { SettingsPage.Visibility=Visibility.Visible; CopyPage.Visibility=Visibility.Collapsed; }
  private void BrowseSource_Click(object s, RoutedEventArgs e) {
   var fileDialog = new OpenFileDialog { Title="Select a file (Cancel to choose a folder)", CheckFileExists=true };
   if(fileDialog.ShowDialog()==true) { sourcePath=fileDialog.FileName; SourceBox.Text=sourcePath; return; }
   using(var d=new Forms.FolderBrowserDialog { Description="Choose the source folder to copy" })
    if(d.ShowDialog()==Forms.DialogResult.OK) { sourcePath=d.SelectedPath; SourceBox.Text=sourcePath; }
  }
  private void BrowseDestination_Click(object s, RoutedEventArgs e) {
   using(var d=new Forms.FolderBrowserDialog { Description="Choose the destination folder" })
    if(d.ShowDialog()==Forms.DialogResult.OK) { destinationPath=d.SelectedPath; DestinationBox.Text=destinationPath; }
  }
  private async void StartCopy_Click(object s, RoutedEventArgs e) {
   if(String.IsNullOrWhiteSpace(sourcePath)||!File.Exists(sourcePath)&&!Directory.Exists(sourcePath)) { MessageBox.Show("Choose a valid source file or folder first.","DATAVOX"); return; }
   if(String.IsNullOrWhiteSpace(destinationPath)||!Directory.Exists(destinationPath)) { MessageBox.Show("Choose an existing destination folder first.","DATAVOX"); return; }
   string srcFull=Path.GetFullPath(sourcePath).TrimEnd(Path.DirectorySeparatorChar);
   string dstFull=Path.GetFullPath(destinationPath).TrimEnd(Path.DirectorySeparatorChar);
   if(Directory.Exists(sourcePath) && (dstFull.Equals(srcFull,StringComparison.OrdinalIgnoreCase)||dstFull.StartsWith(srcFull+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))) {
    MessageBox.Show("The destination cannot be the source folder or one of its subfolders.","DATAVOX"); return;
   }
   cancellation=new CancellationTokenSource(); StartButton.IsEnabled=false; CancelButton.IsEnabled=true; CopyProgress.Value=0;
   try {
    var files=File.Exists(sourcePath)?new[]{sourcePath}:Directory.GetFiles(sourcePath,"*",SearchOption.AllDirectories);
    long total=files.Sum(f=>new FileInfo(f).Length), copied=0; int count=0, skipped=0;
    foreach(var file in files) {
     cancellation.Token.ThrowIfCancellationRequested();
     string relative=File.Exists(sourcePath)?Path.GetFileName(file):file.Substring(sourcePath.TrimEnd(Path.DirectorySeparatorChar).Length).TrimStart(Path.DirectorySeparatorChar);
     string target=Path.Combine(destinationPath,relative);
     Directory.CreateDirectory(Path.GetDirectoryName(target));
     if(File.Exists(target)) { skipped++; continue; }
     await Task.Run(()=>File.Copy(file,target,false),cancellation.Token);
     copied+=new FileInfo(file).Length; count++;
     CopyProgress.Value=total==0?100:(double)copied/total*100;
     ProgressPercent.Text=CopyProgress.Value.ToString("0")+"%";
     StatusText.Text="Copied "+count+" file(s) · "+FormatBytes(copied)+" of "+FormatBytes(total);
    }
    ProgressPercent.Text="Complete"; StatusText.Text="Copy completed. "+count+" file(s) copied; "+skipped+" existing file(s) skipped.";
    CopyProgress.Value=100;
   } catch(OperationCanceledException) { StatusText.Text="Copy cancelled. Files already copied remain in the destination."; ProgressPercent.Text="Cancelled"; }
   catch(Exception ex) { StatusText.Text="Copy stopped: "+ex.Message; ProgressPercent.Text="Error"; MessageBox.Show(ex.Message,"DATAVOX — Copy error",MessageBoxButton.OK,MessageBoxImage.Error); }
   finally { StartButton.IsEnabled=true; CancelButton.IsEnabled=false; if(cancellation!=null){cancellation.Dispose();cancellation=null;} }
  }
  private void CancelCopy_Click(object s, RoutedEventArgs e) { if(cancellation!=null)cancellation.Cancel(); }
  private void ThemeButton_Click(object s, RoutedEventArgs e) { lightTheme=!lightTheme; ApplyTheme(); }
  private void SaveSettings_Click(object s, RoutedEventArgs e) {
   lightTheme=ThemeChoice.SelectedIndex==1; ApplyTheme(); MessageBox.Show("Appearance preference applied for this session.","DATAVOX"); 
  }
  private void ApplyTheme() {
   var bg=(Color)ColorConverter.ConvertFromString(lightTheme?"#F1F4F9":"#0B1220");
   var panel=(Color)ColorConverter.ConvertFromString(lightTheme?"#FFFFFF":"#111C2D");
   var text=(Color)ColorConverter.ConvertFromString(lightTheme?"#17243A":"#E8EEF8");
   Background=new SolidColorBrush(bg);
   // Keep this first foundation build intentionally conservative; a full theme resource pass follows.
   ThemeButton.Content=lightTheme?"Dark theme":"Light theme";
   if(lightTheme) MessageBox.Show("Light theme selection is recorded for this session. Full light-theme styling will be completed in the visual polish pass.","DATAVOX");
  }
  private string FormatBytes(long n) { string[] u={"B","KB","MB","GB","TB"}; double x=n; int i=0; while(x>=1024&&i<u.Length-1){x/=1024;i++;} return x.ToString("0.##")+" "+u[i]; }
 }
}
